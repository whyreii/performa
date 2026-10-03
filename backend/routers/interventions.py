"""Monthly intervention pipeline and employer sign-off routes.

``POST /{employee_id}/monthly-rollup`` aggregates weekly evaluations into a
``MonthlySummary``, classifies risk with the local Random Forest predictor,
maps deficient competencies to catalog interventions, generates GenAI
rationales, and persists the resulting ``TrainingPlan`` rows as
``pending_approval``.

Every query is scoped to ``current_user.organization_id``. Training plans have
no direct tenant column, so they are always joined through their
``ProbationaryEmployee``.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from statistics import fmean
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user, require_role
from ..audit import record_activity
from ..database import get_db
from ..notifications import create_notification
from ..gemini import generate_performance_rationales
from ..ml.catalog import COMPETENCIES, recommend_courses
from ..ml.predictor import predict_employee_risk
from ..models import (
    MonthlySummary,
    PerformanceRatingEnum,
    ProbationaryEmployee,
    ProbationStatus,
    TrainingPlan,
    TrainingStatusEnum,
    User,
    UserRole,
    WeeklyEvaluation,
)
from ..schemas import (
    MonthlySummaryResponse,
    TrainingPlanResponse,
    TrainingPlanSignOff,
)

router = APIRouter(prefix="/api/interventions", tags=["Interventions"])

logger = logging.getLogger(__name__)

PROBATION_MONTH_DAYS = 30


def _course_id(course: dict[str, Any]) -> str:
    return str(course.get("catalog_id") or course.get("course_id") or "")


def _course_fields(course: dict[str, Any]) -> dict[str, Any]:
    """Adapt a catalog course to ``TrainingPlan`` column values."""
    return {
        "competency": str(course.get("competency") or ""),
        "catalog_id": _course_id(course),
        "intervention_title": str(
            course.get("intervention_title") or course.get("title") or ""
        ),
        "intervention_type": str(
            course.get("intervention_type")
            or course.get("training_type")
            or "training"
        ),
        "default_timeline": str(
            course.get("default_timeline")
            or f"{course.get('duration_hours', '')} hours".strip()
        ),
    }


def _to_rating(value: str) -> PerformanceRatingEnum:
    """Coerce a predicted tier label to the stored enum, with a safe default."""
    try:
        return PerformanceRatingEnum(value)
    except ValueError:
        logger.warning(
            "Unknown predicted tier %r; defaulting to %s",
            value,
            PerformanceRatingEnum.NEEDS_IMPROVEMENT.value,
        )
        return PerformanceRatingEnum.NEEDS_IMPROVEMENT


async def _get_scoped_employee(
    db: AsyncSession,
    employee_id: uuid.UUID,
    current_user: User,
) -> ProbationaryEmployee:
    stmt = (
        select(ProbationaryEmployee)
        .options(selectinload(ProbationaryEmployee.user))
        .where(
            ProbationaryEmployee.id == employee_id,
            ProbationaryEmployee.organization_id == current_user.organization_id,
        )
    )
    employee = (await db.execute(stmt)).scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Probationary employee not found",
        )
    if current_user.role == UserRole.SUPERVISOR and employee.supervisor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisors may only access employees assigned to them",
        )
    return employee


@router.post(
    "/{employee_id}/monthly-rollup",
    response_model=MonthlySummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Roll up weekly scores, classify risk, and generate interventions",
)
async def monthly_rollup(
    employee_id: uuid.UUID,
    month_number: int = Query(..., ge=1, le=12, description="Probation month number"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> MonthlySummary:
    """Aggregate evaluations and produce a MonthlySummary plus training plans."""
    employee = await _get_scoped_employee(db, employee_id, current_user)

    if employee.status != ProbationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Monthly rollups can only be generated for active probationary employees.",
        )

    month_start = employee.start_date + timedelta(
        days=(month_number - 1) * PROBATION_MONTH_DAYS
    )
    # Non-overlapping 30-day window: [month_start, month_start + 30 - 1].
    # The previous inclusive end equalled the next month's start, so a boundary
    # date (day 30/60/90/120) was counted in two months.
    month_end = employee.start_date + timedelta(
        days=month_number * PROBATION_MONTH_DAYS - 1
    )

    evaluation_stmt = select(WeeklyEvaluation).where(
        WeeklyEvaluation.employee_id == employee.id,
        WeeklyEvaluation.organization_id == current_user.organization_id,
        WeeklyEvaluation.evaluation_date >= month_start,
        WeeklyEvaluation.evaluation_date <= month_end,
    )
    evaluations = list((await db.execute(evaluation_stmt)).scalars().all())
    if not evaluations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"No weekly evaluations found for month {month_number} "
                f"({month_start.isoformat()} to {month_end.isoformat()})"
            ),
        )

    # Compute the five competency averages in canonical COMPETENCIES order.
    competency_scores = {
        competency: fmean(float(getattr(evaluation, competency)) for evaluation in evaluations)
        for competency in COMPETENCIES
    }

    averages = {
        "avg_task_completion": competency_scores["task_completion"],
        "avg_attendance": competency_scores["attendance_and_punctuality"],
        "avg_communication": competency_scores["communication_and_teamwork"],
        "avg_initiative": competency_scores["initiative_and_adaptability"],
        "avg_quality": competency_scores["quality_of_work"],
    }
    overall_average = fmean(competency_scores.values())

    try:
        prediction = predict_employee_risk(competency_scores)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI risk model is unavailable. Please contact the administrator.",
        )

    predicted_tier = str(prediction["predicted_tier"])
    flagged = list(prediction.get("flagged_competencies", []))

    courses: list[dict[str, Any]] = []
    seen_course_ids: set[str] = set()
    for competency in flagged:
        for course in recommend_courses(competency):
            course_id = _course_id(course)
            if course_id and course_id not in seen_course_ids:
                seen_course_ids.add(course_id)
                courses.append(course)

    summary_text, rationales = await generate_performance_rationales(
        employee_name=employee.user.full_name if employee.user else "",
        month_number=month_number,
        status_classification=predicted_tier,
        competency_scores=competency_scores,
        recommended_courses=courses,
    )

    # Regenerate the month in place (idempotent, non-destructive):
    # preserve dispatch/acknowledgement records and existing plan decisions.
    existing = (
        await db.execute(
            select(MonthlySummary).where(
                MonthlySummary.employee_id == employee.id,
                MonthlySummary.month_number == month_number,
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        if existing.dispatched_at is not None or existing.acknowledged_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This month's summary has already been dispatched or "
                    "acknowledged and cannot be regenerated (evidentiary record)."
                ),
            )
        existing.overall_average = overall_average
        existing.status_classification = _to_rating(predicted_tier)
        existing.performance_summary = summary_text
        for field, value in averages.items():
            setattr(existing, field, value)
        summary = existing
        await db.flush()

        existing_plans = list(
            (
                await db.execute(
                    select(TrainingPlan).where(
                        TrainingPlan.monthly_summary_id == summary.id
                    )
                )
            )
            .scalars()
            .all()
        )
        plans_by_catalog = {plan.catalog_id: plan for plan in existing_plans}
        desired_catalog_ids: set[str] = set()
        for course in courses:
            fields = _course_fields(course)
            catalog_id = fields["catalog_id"]
            desired_catalog_ids.add(catalog_id)
            plan = plans_by_catalog.get(catalog_id)
            if plan is not None:
                plan.rationale = rationales.get(catalog_id, "")
            else:
                db.add(
                    TrainingPlan(
                        employee_id=employee.id,
                        monthly_summary_id=summary.id,
                        rationale=rationales.get(catalog_id, ""),
                        status=TrainingStatusEnum.PENDING_APPROVAL,
                        **fields,
                    )
                )
        # Drop no-longer-recommended plans, but keep APPROVED and REJECTED ones
        # for the audit trail (only un-decided PENDING plans are removed).
        for catalog_id, plan in plans_by_catalog.items():
            if catalog_id not in desired_catalog_ids and plan.status not in (
                TrainingStatusEnum.APPROVED,
                TrainingStatusEnum.REJECTED,
            ):
                await db.delete(plan)
    else:
        summary = MonthlySummary(
            employee_id=employee.id,
            month_number=month_number,
            overall_average=overall_average,
            status_classification=_to_rating(predicted_tier),
            performance_summary=summary_text,
            **averages,
        )
        db.add(summary)
        await db.flush()

        for course in courses:
            fields = _course_fields(course)
            db.add(
                TrainingPlan(
                    employee_id=employee.id,
                    monthly_summary_id=summary.id,
                    rationale=rationales.get(fields["catalog_id"], ""),
                    status=TrainingStatusEnum.PENDING_APPROVAL,
                    **fields,
                )
            )

    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="rollup.generate",
        entity_type="monthly_summary",
        entity_id=summary.id,
        detail=f"month={month_number}",
    )
    await db.commit()
    await db.refresh(summary)
    return summary


@router.get(
    "/mine",
    response_model=list[TrainingPlanResponse],
    summary="List the current employee's own training interventions",
)
async def list_my_interventions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TrainingPlan]:
    """Return all training plans attached to the caller's own employee profile."""
    employee = (
        await db.execute(
            select(ProbationaryEmployee).where(
                ProbationaryEmployee.user_id == current_user.id,
                ProbationaryEmployee.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No probationary employee profile is linked to this account",
        )

    stmt = (
        select(TrainingPlan)
        .where(
            TrainingPlan.employee_id == employee.id,
            TrainingPlan.status == TrainingStatusEnum.APPROVED,
        )
        .order_by(TrainingPlan.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/summaries",
    response_model=list[MonthlySummaryResponse],
    summary="List monthly summaries for the tenant",
)
async def list_monthly_summaries(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.EMPLOYER)),
) -> list[MonthlySummary]:
    """Return all monthly summaries for employees in the tenant, newest first."""
    stmt = (
        select(MonthlySummary)
        .join(ProbationaryEmployee, MonthlySummary.employee_id == ProbationaryEmployee.id)
        .where(ProbationaryEmployee.organization_id == current_user.organization_id)
        .order_by(MonthlySummary.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


@router.get(
    "/summaries/mine",
    response_model=list[MonthlySummaryResponse],
    summary="List the current employee's dispatched monthly summaries",
)
async def list_my_summaries(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MonthlySummary]:
    """Return monthly summaries dispatched to the caller's own employee profile."""
    employee = (
        await db.execute(
            select(ProbationaryEmployee).where(
                ProbationaryEmployee.user_id == current_user.id,
                ProbationaryEmployee.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No probationary employee profile is linked to this account",
        )

    stmt = (
        select(MonthlySummary)
        .where(
            MonthlySummary.employee_id == employee.id,
            MonthlySummary.dispatched_at.isnot(None),
        )
        .order_by(MonthlySummary.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


@router.post(
    "/summaries/{summary_id}/dispatch",
    response_model=MonthlySummaryResponse,
    summary="Dispatch a monthly summary to the employee for acknowledgement",
)
async def dispatch_monthly_summary(
    summary_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> MonthlySummary:
    """Mark a monthly summary as dispatched to the employee."""
    summary = (
        await db.execute(
            select(MonthlySummary)
            .join(ProbationaryEmployee, MonthlySummary.employee_id == ProbationaryEmployee.id)
            .where(
                MonthlySummary.id == summary_id,
                ProbationaryEmployee.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monthly summary not found",
        )

    if summary.dispatched_at is None:
        summary.dispatched_at = datetime.now(timezone.utc)
        record_activity(
            db,
            organization_id=current_user.organization_id,
            actor=current_user,
            action="summary.dispatch",
            entity_type="monthly_summary",
            entity_id=summary.id,
        )
        employee_user_id = (
            await db.execute(
                select(ProbationaryEmployee.user_id).where(
                    ProbationaryEmployee.id == summary.employee_id
                )
            )
        ).scalar_one()
        create_notification(
            db,
            user_id=employee_user_id,
            organization_id=current_user.organization_id,
            title="Monthly performance summary available",
            body=(
                f"Your month {summary.month_number} performance summary has been "
                "shared. Please review and acknowledge it."
            ),
            category="summary",
        )
        await db.commit()
        await db.refresh(summary)
    return summary


@router.post(
    "/summaries/{summary_id}/acknowledge",
    response_model=MonthlySummaryResponse,
    summary="Employee acknowledges receipt of a monthly summary",
)
async def acknowledge_monthly_summary(
    summary_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MonthlySummary:
    """Record the employee's digital acknowledgement of a dispatched summary."""
    employee = (
        await db.execute(
            select(ProbationaryEmployee).where(
                ProbationaryEmployee.user_id == current_user.id,
                ProbationaryEmployee.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No probationary employee profile is linked to this account",
        )

    summary = (
        await db.execute(
            select(MonthlySummary).where(
                MonthlySummary.id == summary_id,
                MonthlySummary.employee_id == employee.id,
            )
        )
    ).scalar_one_or_none()
    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monthly summary not found",
        )
    if summary.dispatched_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This summary has not been dispatched yet",
        )

    if summary.acknowledged_at is None:
        summary.acknowledged_at = datetime.now(timezone.utc)
        record_activity(
            db,
            organization_id=current_user.organization_id,
            actor=current_user,
            action="summary.acknowledge",
            entity_type="monthly_summary",
            entity_id=summary.id,
        )
        await db.commit()
        await db.refresh(summary)
    return summary


@router.get(
    "/pending",
    response_model=list[TrainingPlanResponse],
    summary="List pending training interventions for the tenant",
)
async def list_pending_interventions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN, UserRole.EMPLOYER, UserRole.SUPERVISOR)
    ),
) -> list[TrainingPlan]:
    """Return pending interventions, scoped to the tenant (and to a supervisor's team)."""
    stmt = (
        select(TrainingPlan)
        .join(ProbationaryEmployee, TrainingPlan.employee_id == ProbationaryEmployee.id)
        .where(
            TrainingPlan.status == TrainingStatusEnum.PENDING_APPROVAL,
            ProbationaryEmployee.organization_id == current_user.organization_id,
        )
        .order_by(TrainingPlan.created_at.desc())
    )
    if current_user.role == UserRole.SUPERVISOR:
        stmt = stmt.where(ProbationaryEmployee.supervisor_id == current_user.id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "/{plan_id}/sign-off",
    response_model=TrainingPlanResponse,
    summary="Employer sign-off for a pending training intervention",
)
async def sign_off_intervention(
    plan_id: uuid.UUID,
    payload: TrainingPlanSignOff,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> TrainingPlan:
    """Approve or reject a pending intervention within the caller's tenant."""
    stmt = (
        select(TrainingPlan)
        .join(ProbationaryEmployee, TrainingPlan.employee_id == ProbationaryEmployee.id)
        .where(
            TrainingPlan.id == plan_id,
            ProbationaryEmployee.organization_id == current_user.organization_id,
        )
    )
    plan = (await db.execute(stmt)).scalar_one_or_none()
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training plan not found",
        )

    if plan.status != TrainingStatusEnum.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This intervention has already been decided and cannot be changed.",
        )

    if payload.approved:
        plan.status = TrainingStatusEnum.APPROVED
        plan.employer_approved_at = datetime.now(timezone.utc)
    else:
        plan.status = TrainingStatusEnum.REJECTED
        plan.employer_approved_at = None

    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="plan.sign_off",
        entity_type="training_plan",
        entity_id=plan.id,
        detail=f"approved={payload.approved}",
    )
    employee_user_id = (
        await db.execute(
            select(ProbationaryEmployee.user_id).where(
                ProbationaryEmployee.id == plan.employee_id
            )
        )
    ).scalar_one()
    create_notification(
        db,
        user_id=employee_user_id,
        organization_id=current_user.organization_id,
        title=f"Training intervention {'approved' if payload.approved else 'not approved'}",
        body=plan.intervention_title,
        category="training",
    )
    await db.commit()
    await db.refresh(plan)
    return plan


__all__ = ["router"]
