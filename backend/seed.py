"""Idempotent database seed for Performa.

Run with::

    python -m backend.seed

The script tears down any existing records for the seeded tenant in strict
child-to-parent order, recreates the demo tenant ("Acme Philippines Corp." per
docs/DECISIONS.md J4), the system accounts, and four probationary employees
positioned around the Article 296 milestones (Day 150 / 165 / 178 / 180).
"""
from __future__ import annotations

import argparse
import asyncio
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .audit_chain import audit_record_hash
from .audit_immutability import drop_statements_for, statements_for
from .auth import get_password_hash
from .database import Base, async_session_maker, engine
from .domain import PROBATION_TERM_DAYS
from .timeutils import MANILA_TZ, manila_today
from .models import (
    ActivityLog,
    CustomKpi,
    CustomKpiRating,
    EmailVerificationToken,
    EmployeeCustomKpi,
    EvaluationAuditLog,
    KpiRubric,
    MonthlySummary,
    Notification,
    Organization,
    PasswordResetToken,
    ProbationaryEmployee,
    ProbationStatus,
    RegularizationRecommendation,
    TrainingPlan,
    User,
    UserRole,
    WeeklyEvaluation,
)

logger = logging.getLogger("performa.seed")

SEED_PASSWORD = "Password123!"
ORG_NAME = "Acme Philippines Corp."
ORG_SLUG = "acme-ph"
ADMIN_EMAIL = "admin@acme.com"
EMPLOYER_EMAIL = "employer@acme.com"
SUPERVISOR_EMAIL = "supervisor@acme.com"


@dataclass(frozen=True)
class _EmployeeSpec:
    email: str
    full_name: str
    department: str
    job_title: str
    days_elapsed: int
    assign_supervisor: bool
    scenario: str


_EMPLOYEE_SPECS: tuple[_EmployeeSpec, ...] = (
    _EmployeeSpec(
        email="emp1@acme.com",
        full_name="Carlos Early",
        department="Engineering",
        job_title="Junior Dev",
        days_elapsed=30,
        assign_supervisor=True,
        scenario="Day 30 - Onboarding / Nominal",
    ),
    _EmployeeSpec(
        email="emp2@acme.com",
        full_name="Maria Midterm",
        department="Engineering",
        job_title="QA Engineer",
        days_elapsed=152,
        assign_supervisor=True,
        scenario="Day 152 - 1st Warning / Overdue Day 150",
    ),
    _EmployeeSpec(
        email="emp3@acme.com",
        full_name="Pedro Notice",
        department="Operations",
        job_title="Operations Associate",
        days_elapsed=166,
        assign_supervisor=False,
        scenario="Day 166 - 2nd Warning / Notice Period Threshold",
    ),
    _EmployeeSpec(
        email="emp4@acme.com",
        full_name="Ana Urgent",
        department="Finance",
        job_title="Accountant",
        days_elapsed=179,
        assign_supervisor=False,
        scenario="Day 179 - Critical Threshold / Day before auto-regularization",
    ),
)


@dataclass(frozen=True)
class SeededAccount:
    email: str
    full_name: str
    role: str
    password: str


@dataclass(frozen=True)
class SeededEmployee:
    email: str
    full_name: str
    department: str
    job_title: str
    start_date: date
    day_number: int
    day_180_date: date
    supervisor: str
    scenario: str


@dataclass(frozen=True)
class SeedResult:
    organization: str
    organization_slug: str
    accounts: list[SeededAccount]
    employees: list[SeededEmployee]


async def _reset(session: AsyncSession) -> None:
    """Delete existing tenant records in child-to-parent dependency order."""
    employee_ids = select(ProbationaryEmployee.id).where(
        ProbationaryEmployee.organization_id == ORG_SLUG
    )
    user_ids = select(User.id).where(User.organization_id == ORG_SLUG)

    # FK-bearing tables must be cleared before their parents. SQLite does not
    # enforce foreign keys by default (tests now enable the pragma), but
    # PostgreSQL always does — so these deletes are required for parity.
    await session.execute(
        delete(RegularizationRecommendation).where(
            RegularizationRecommendation.employee_id.in_(employee_ids)
        )
    )
    await session.execute(
        delete(Notification).where(
            Notification.user_id.in_(user_ids)
            | (Notification.organization_id == ORG_SLUG)
        )
    )
    await session.execute(
        delete(ActivityLog).where(
            (ActivityLog.organization_id == ORG_SLUG)
            | ActivityLog.actor_id.in_(user_ids)
        )
    )
    # The Evidentiary Labor Score Audit Trail is DB-immutable. A demo reset is a
    # bootstrap operation, so it lifts the triggers for this one delete and
    # re-installs them immediately afterwards.
    dialect = session.get_bind().dialect.name
    for statement in drop_statements_for(dialect):
        await session.execute(text(statement))
    await session.execute(
        delete(EvaluationAuditLog).where(
            EvaluationAuditLog.employee_id.in_(employee_ids)
            | EvaluationAuditLog.evaluator_id.in_(user_ids)
        )
    )
    for statement in statements_for(dialect):
        await session.execute(text(statement))
    await session.execute(
        delete(CustomKpiRating).where(CustomKpiRating.organization_id == ORG_SLUG)
    )
    await session.execute(
        delete(TrainingPlan).where(TrainingPlan.employee_id.in_(employee_ids))
    )
    await session.execute(
        delete(MonthlySummary).where(MonthlySummary.employee_id.in_(employee_ids))
    )
    await session.execute(
        delete(WeeklyEvaluation).where(
            WeeklyEvaluation.employee_id.in_(employee_ids)
            | WeeklyEvaluation.evaluator_id.in_(user_ids)
        )
    )
    await session.execute(
        delete(ProbationaryEmployee).where(
            ProbationaryEmployee.organization_id == ORG_SLUG
        )
    )
    await session.execute(
        delete(KpiRubric).where(KpiRubric.organization_id == ORG_SLUG)
    )
    await session.execute(
        delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(user_ids))
    )
    await session.execute(
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id.in_(user_ids))
    )
    await session.execute(
        delete(EmployeeCustomKpi).where(EmployeeCustomKpi.organization_id == ORG_SLUG)
    )
    await session.execute(
        delete(CustomKpi).where(CustomKpi.organization_id == ORG_SLUG)
    )
    await session.execute(delete(User).where(User.organization_id == ORG_SLUG))
    await session.execute(delete(Organization).where(Organization.slug == ORG_SLUG))
    await session.flush()


_DEMO_EVALUATION_BASE: dict[str, float] = {
    "emp1@acme.com": 4.0,   # Carlos Early: Month 1 complete
    "emp2@acme.com": 4.3,   # Maria Midterm: Months 1-5 complete
    "emp4@acme.com": 2.8,   # Ana Urgent: critical gaps justifying notice
}

# Varied, realistic weekly remarks (no placeholder text).
_DEMO_REMARKS: tuple[str, ...] = (
    "Delivered the weekly deliverables ahead of schedule; quality was solid.",
    "Met output targets; a couple of items needed minor revisions.",
    "Collaborated well in the sprint review and flagged blockers early.",
    "Punctual and dependable; took initiative on the backlog clean-up.",
    "Quality slipped on two deliverables; coaching on the QC checklist noted.",
    "Turnaround improved after last week's feedback; keep it up.",
    "Communicated status clearly; more proactive hand-offs would help.",
    "Steady output this week; risks could have been raised earlier.",
    "Strong attention to detail; documentation was thorough.",
    "Attendance and punctuality were consistent; no concerns.",
)

_COMPETENCY_KEYS: tuple[str, ...] = (
    "task_completion",
    "attendance_and_punctuality",
    "communication_and_teamwork",
    "initiative_and_adaptability",
    "quality_of_work",
)


async def _seed_evaluations(
    session: AsyncSession,
    employees_by_email: dict[str, ProbationaryEmployee],
    evaluator_id,
    organization_id: str,
    today: date,
) -> int:
    """Create realistic demo weekly evaluations (and matching audit entries).

    Each employee is rated weekly from their start date up to ``today`` (the
    statutory Day-0 convention: the start date is the first rating). Audit rows
    carry the evaluation date so the evidentiary history shows when the score was
    actually recorded, not the seed run time.
    """
    created = 0
    for ordinal, (email, base) in enumerate(_DEMO_EVALUATION_BASE.items()):
        employee = employees_by_email.get(email)
        if employee is None:
            continue
        previous: dict[str, float] = {}
        prev_hash = None
        week = 1
        while True:
            evaluation_date = employee.start_date + timedelta(days=(week - 1) * 7)
            if evaluation_date > today:
                break
            scores = {
                key: round(min(5.0, max(1.0, base + ((week + index) % 3 - 1) * 0.2)), 1)
                for index, key in enumerate(_COMPETENCY_KEYS)
            }
            overall = round(sum(scores.values()) / len(scores), 2)
            # Stored as UTC (like every other timestamp) so SQLite's tzinfo loss
            # preserves the instant: 09:00 Manila → 01:00 UTC → renders as 09:00.
            recorded_at = datetime(
                evaluation_date.year,
                evaluation_date.month,
                evaluation_date.day,
                9,
                0,
                tzinfo=MANILA_TZ,
            ).astimezone(timezone.utc)
            session.add(
                WeeklyEvaluation(
                    employee_id=employee.id,
                    evaluator_id=evaluator_id,
                    organization_id=organization_id,
                    evaluation_date=evaluation_date,
                    week_number=week,
                    overall_score=overall,
                    remarks=_DEMO_REMARKS[(week + ordinal) % len(_DEMO_REMARKS)],
                    **scores,
                )
            )
            for index, key in enumerate(_COMPETENCY_KEYS):
                # Strictly-increasing timestamps per row, mirroring the live write
                # path, so the per-employee hash chain verifies in created_at order.
                row_time = recorded_at + timedelta(microseconds=index)
                record_hash = audit_record_hash(
                    prev_hash,
                    organization_id,
                    employee.id,
                    evaluator_id,
                    key,
                    previous.get(key),
                    scores[key],
                    row_time,
                )
                session.add(
                    EvaluationAuditLog(
                        employee_id=employee.id,
                        evaluator_id=evaluator_id,
                        organization_id=organization_id,
                        competency=key,
                        prior_score=previous.get(key),
                        new_score=scores[key],
                        created_at=row_time,
                        prev_hash=prev_hash,
                        record_hash=record_hash,
                    )
                )
                prev_hash = record_hash
            previous = scores
            created += 1
            week += 1
    await session.flush()
    return created


async def seed(
    session: AsyncSession, with_evaluations: bool = True
) -> SeedResult:
    """Seed the demo tenant and return a result summary."""
    await _reset(session)

    today = manila_today()

    organization = Organization(name=ORG_NAME, slug=ORG_SLUG)
    session.add(organization)
    await session.flush()
    tenant_key = organization.slug

    admin = User(
        email=ADMIN_EMAIL,
        hashed_password=get_password_hash(SEED_PASSWORD),
        full_name="System Administrator",
        role=UserRole.ADMIN,
        organization_id=tenant_key,
        is_active=True,
    )
    employer = User(
        email=EMPLOYER_EMAIL,
        hashed_password=get_password_hash(SEED_PASSWORD),
        full_name="Cecile Robelo",
        role=UserRole.EMPLOYER,
        organization_id=tenant_key,
        is_active=True,
    )
    supervisor = User(
        email=SUPERVISOR_EMAIL,
        hashed_password=get_password_hash(SEED_PASSWORD),
        full_name="Supervisor Juan",
        role=UserRole.SUPERVISOR,
        organization_id=tenant_key,
        is_active=True,
    )
    session.add_all([admin, employer, supervisor])
    await session.flush()

    accounts: list[SeededAccount] = [
        SeededAccount(ADMIN_EMAIL, admin.full_name, admin.role.value, SEED_PASSWORD),
        SeededAccount(
            EMPLOYER_EMAIL, employer.full_name, employer.role.value, SEED_PASSWORD
        ),
        SeededAccount(
            SUPERVISOR_EMAIL, supervisor.full_name, supervisor.role.value, SEED_PASSWORD
        ),
    ]
    employees: list[SeededEmployee] = []
    employees_by_email: dict[str, ProbationaryEmployee] = {}

    for spec in _EMPLOYEE_SPECS:
        start_date = today - timedelta(days=spec.days_elapsed)
        day_180_date = start_date + timedelta(days=PROBATION_TERM_DAYS)

        user = User(
            email=spec.email,
            hashed_password=get_password_hash(SEED_PASSWORD),
            full_name=spec.full_name,
            role=UserRole.PROBATIONARY_EMPLOYEE,
            organization_id=tenant_key,
            is_active=True,
        )
        session.add(user)
        await session.flush()

        employee = ProbationaryEmployee(
            user_id=user.id,
            employer_id=employer.id,
            supervisor_id=supervisor.id if spec.assign_supervisor else None,
            organization_id=tenant_key,
            job_title=spec.job_title,
            department=spec.department,
            start_date=start_date,
            day_180_date=day_180_date,
            status=ProbationStatus.ACTIVE,
        )
        session.add(employee)
        await session.flush()
        employees_by_email[spec.email] = employee

        accounts.append(
            SeededAccount(
                spec.email,
                spec.full_name,
                UserRole.PROBATIONARY_EMPLOYEE.value,
                SEED_PASSWORD,
            )
        )
        employees.append(
            SeededEmployee(
                email=spec.email,
                full_name=spec.full_name,
                department=spec.department,
                job_title=spec.job_title,
                start_date=start_date,
                day_number=spec.days_elapsed,
                day_180_date=day_180_date,
                supervisor=supervisor.full_name if spec.assign_supervisor else "-",
                scenario=spec.scenario,
            )
        )

    if with_evaluations:
        await _seed_evaluations(
            session, employees_by_email, supervisor.id, tenant_key, today
        )

    await session.commit()

    return SeedResult(
        organization=ORG_NAME,
        organization_slug=tenant_key,
        accounts=accounts,
        employees=employees,
    )


def _format_table(headers: Sequence[str], rows: Sequence[Sequence[object]]) -> str:
    """Render a simple, aligned plain-text table."""
    widths = [len(header) for header in headers]
    for row in rows:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], len(str(cell)))

    def render(cells: Sequence[object]) -> str:
        return " | ".join(
            str(cell).ljust(widths[index]) for index, cell in enumerate(cells)
        )

    separator = "-+-".join("-" * width for width in widths)
    lines = [render(headers), separator]
    lines.extend(render(row) for row in rows)
    return "\n".join(lines)


def _log_result(result: SeedResult) -> None:
    logger.info(
        "Seed complete for %s (tenant key: %s)",
        result.organization,
        result.organization_slug,
    )
    logger.info(
        "Accounts (password: %s)\n%s",
        SEED_PASSWORD,
        _format_table(
            ["Email", "Full Name", "Role", "Password"],
            [[a.email, a.full_name, a.role, a.password] for a in result.accounts],
        ),
    )
    logger.info(
        "Probationary employee scenarios\n%s",
        _format_table(
            [
                "Email",
                "Name",
                "Department",
                "Position",
                "Start",
                "Day",
                "Day 180",
                "Supervisor",
                "Scenario",
            ],
            [
                [
                    e.email,
                    e.full_name,
                    e.department,
                    e.job_title,
                    e.start_date.isoformat(),
                    e.day_number,
                    e.day_180_date.isoformat(),
                    e.supervisor,
                    e.scenario,
                ]
                for e in result.employees
            ],
        ),
    )


async def main() -> None:
    """Create schema (if needed), seed the tenant, and always dispose."""
    parser = argparse.ArgumentParser(description="Seed the Performa demo tenant.")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Seed demo weekly evaluations (default behavior).",
    )
    parser.add_argument(
        "--no-evaluations",
        action="store_true",
        help="Skip demo weekly evaluations (empty ratings; for tests/CI).",
    )
    args = parser.parse_args()
    with_evaluations = not args.no_evaluations

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    result: SeedResult | None = None
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with async_session_maker() as session:
            try:
                result = await seed(session, with_evaluations=with_evaluations)
            except Exception:
                await session.rollback()
                logger.exception("Seeding transaction failed; rolled back")
                raise
    finally:
        await engine.dispose()

    assert result is not None
    _log_result(result)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        logger.exception("Seed run failed")
        raise SystemExit(1)
