"""Idempotent database seed for Performa.

Run with::

    python -m backend.seed

The script tears down any existing records for the seeded tenant in strict
child-to-parent order, recreates Acme Philippines Corp., the two system
accounts, and four probationary employees positioned around the Article 296
milestones (Day 150 / 165 / 178 / 180).
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone, tzinfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_password_hash
from .database import Base, async_session_maker, engine
from .models import (
    EvaluationAuditLog,
    KpiRubric,
    MonthlySummary,
    Organization,
    ProbationaryEmployee,
    ProbationStatus,
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
SUPERVISOR_EMAIL = "supervisor@acme.com"
PROBATION_TERM_DAYS = 180


def _manila_tz() -> tzinfo:
    """Return the Asia/Manila timezone, falling back to a fixed UTC+8 offset."""
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo("Asia/Manila")
    except Exception:
        return timezone(timedelta(hours=8))


MANILA_TZ = _manila_tz()


def _today_manila() -> date:
    """Current calendar date in the statutory (Asia/Manila) timezone."""
    return datetime.now(MANILA_TZ).date()


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

    await session.execute(
        delete(EvaluationAuditLog).where(
            EvaluationAuditLog.employee_id.in_(employee_ids)
            | EvaluationAuditLog.evaluator_id.in_(user_ids)
        )
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
            | WeeklyEvaluation.supervisor_id.in_(user_ids)
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
    await session.execute(delete(User).where(User.organization_id == ORG_SLUG))
    await session.execute(delete(Organization).where(Organization.slug == ORG_SLUG))
    await session.flush()


async def seed(session: AsyncSession) -> SeedResult:
    """Seed the Acme Philippines Corp. tenant and return a result summary."""
    await _reset(session)

    today = _today_manila()

    organization = Organization(name=ORG_NAME, slug=ORG_SLUG)
    session.add(organization)
    await session.flush()
    tenant_key = organization.slug

    admin = User(
        email=ADMIN_EMAIL,
        hashed_password=get_password_hash(SEED_PASSWORD),
        full_name="Admin User",
        role=UserRole.ADMIN,
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
    session.add_all([admin, supervisor])
    await session.flush()

    accounts: list[SeededAccount] = [
        SeededAccount(ADMIN_EMAIL, admin.full_name, admin.role.value, SEED_PASSWORD),
        SeededAccount(
            SUPERVISOR_EMAIL, supervisor.full_name, supervisor.role.value, SEED_PASSWORD
        ),
    ]
    employees: list[SeededEmployee] = []

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
            employer_id=admin.id,
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
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    result: SeedResult | None = None
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with async_session_maker() as session:
            try:
                result = await seed(session)
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
