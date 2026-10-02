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

import uuid
from datetime import datetime, timezone
from statistics import fmean
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user, require_role
from ..database import get_db
from ..gemini import generate_performance_rationales
from ..ml.catalog import COMPETENCIES, recommend_courses
from ..ml.predictor import predict_employee_risk
from ..models import (
    MonthlySummary,
    PerformanceRatingEnum,
    ProbationaryEmployee,
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
        return PerformanceRatingEnum.NEEDS_IMPROVEMENT


async def _get_scoped_employee(
    db: AsyncSession,
    employee_id: uuid.UUID,
    organization_id: str,
) -> ProbationaryEmployee:
    stmt = (
        select(ProbationaryEmployee)
        .options(selectinload(ProbationaryEmployee.user))
        .where(
            ProbationaryEmployee.id == employee_id,
            ProbationaryEmployee.organization_id == organization_id,
        )
    )
    employee = (await db.execute(stmt)).scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Probationary employee not found",
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
    month_number: int = Query(..., ge=1, description="Probation month number"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN, UserRole.EMPLOYER, UserRole.SUPERVISOR)
    ),
) -> MonthlySummary:
    """Aggregate evaluations and produce a MonthlySummary plus training plans."""
    employee = await _get_scoped_employee(db, employee_id, current_user.organization_id)

    evaluation_stmt = select(WeeklyEvaluation).where(
        WeeklyEvaluation.employee_id == employee.id,
        WeeklyEvaluation.organization_id == current_user.organization_id,
    )
    evaluations = list((await db.execute(evaluation_stmt)).scalars().all())
    if not evaluations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No weekly evaluations found for this employee",
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
            detail=str(exc),
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
    "/pending",
    response_model=list[TrainingPlanResponse],
    summary="List pending training interventions for the tenant",
)
async def list_pending_interventions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.EMPLOYER)),
) -> list[TrainingPlan]:
    """Return every pending intervention for employees in the tenant."""
    stmt = (
        select(TrainingPlan)
        .join(ProbationaryEmployee, TrainingPlan.employee_id == ProbationaryEmployee.id)
        .where(
            TrainingPlan.status == TrainingStatusEnum.PENDING_APPROVAL,
            ProbationaryEmployee.organization_id == current_user.organization_id,
        )
        .order_by(TrainingPlan.created_at.desc())
    )
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
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.EMPLOYER)),
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

    if payload.approved:
        plan.status = TrainingStatusEnum.APPROVED
        plan.employer_approved_at = datetime.now(timezone.utc)
    else:
        plan.status = TrainingStatusEnum.REJECTED
        plan.employer_approved_at = None

    await db.commit()
    await db.refresh(plan)
    return plan


__all__ = ["router"]
