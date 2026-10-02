"""Weekly KPI evaluations, scorecards, and the append-only audit trail.

All lookups are strictly scoped to ``current_user.organization_id``. Rating
submissions are restricted to employers and supervisors; probationary
employees may only read their own scorecard and audit trail.

Audit entries are append-only: one immutable ``EvaluationAuditLog`` row is
written per competency whose score changed or was set for the first time.
"""
from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import (
    EvaluationAuditLog,
    ProbationaryEmployee,
    User,
    UserRole,
    WeeklyEvaluation,
)
from ..schemas import (
    AuditLogItemResponse,
    CompetencyScoreItem,
    EmployeeScorecardResponse,
    WeeklyEvaluationResponse,
    WeeklyRatingSubmit,
)

router = APIRouter(tags=["Evaluations"])

TARGET_SCORE = 4.0

# (model attribute, API key, human-readable label) for the five fixed categories.
COMPETENCIES: tuple[tuple[str, str], ...] = (
    ("task_completion", "Task Completion"),
    ("attendance_and_punctuality", "Attendance & Punctuality"),
    ("communication_and_teamwork", "Communication & Teamwork"),
    ("initiative_and_adaptability", "Initiative & Adaptability"),
    ("quality_of_work", "Quality of Work"),
)


def _scores_from_payload(payload: WeeklyRatingSubmit) -> dict[str, float]:
    """Extract the five competency scores from a submission."""
    return {attribute: float(getattr(payload, attribute)) for attribute, _ in COMPETENCIES}


def _scores_from_evaluation(evaluation: WeeklyEvaluation) -> dict[str, float]:
    """Extract the five competency scores from a stored evaluation."""
    return {attribute: float(getattr(evaluation, attribute)) for attribute, _ in COMPETENCIES}


async def _get_scoped_employee(
    db: AsyncSession,
    employee_id: uuid.UUID,
    current_user: User,
) -> ProbationaryEmployee:
    """Fetch an employee within the caller's tenant, enforcing self-access."""
    stmt = select(ProbationaryEmployee).where(
        ProbationaryEmployee.id == employee_id,
        ProbationaryEmployee.organization_id == current_user.organization_id,
    )
    result = await db.execute(stmt)
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Probationary employee not found",
        )
    if current_user.role == UserRole.PROBATIONARY_EMPLOYEE and employee.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Probationary employees may only access their own records",
        )
    return employee


async def _latest_evaluation(
    db: AsyncSession,
    employee_id: uuid.UUID,
    organization_id: str,
) -> Optional[WeeklyEvaluation]:
    """Return the most recent evaluation for an employee, if any."""
    stmt = (
        select(WeeklyEvaluation)
        .where(
            WeeklyEvaluation.employee_id == employee_id,
            WeeklyEvaluation.organization_id == organization_id,
        )
        .order_by(
            WeeklyEvaluation.evaluation_date.desc(),
            WeeklyEvaluation.created_at.desc(),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


@router.post(
    "/{employee_id}/weekly",
    response_model=WeeklyEvaluationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a weekly rating for a probationary employee",
)
async def submit_weekly_rating(
    employee_id: uuid.UUID,
    payload: WeeklyRatingSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER, UserRole.SUPERVISOR)),
) -> WeeklyEvaluation:
    """Persist a weekly evaluation and append audit entries for changed scores."""
    employee = await _get_scoped_employee(db, employee_id, current_user)

    previous = await _latest_evaluation(db, employee.id, current_user.organization_id)
    prior_scores = _scores_from_evaluation(previous) if previous is not None else {}
    new_scores = _scores_from_payload(payload)

    overall_score = round(sum(new_scores.values()) / len(new_scores), 2)

    evaluation = WeeklyEvaluation(
        employee_id=employee.id,
        evaluator_id=current_user.id,
        organization_id=current_user.organization_id,
        evaluation_date=date.today(),
        overall_score=overall_score,
        remarks=payload.remarks,
        **new_scores,
    )
    db.add(evaluation)
    await db.flush()

    for attribute, _label in COMPETENCIES:
        prior_score = prior_scores.get(attribute)
        new_score = new_scores[attribute]
        if prior_score is None or prior_score != new_score:
            db.add(
                EvaluationAuditLog(
                    employee_id=employee.id,
                    evaluator_id=current_user.id,
                    organization_id=current_user.organization_id,
                    competency=attribute,
                    prior_score=prior_score,
                    new_score=new_score,
                )
            )

    await db.commit()
    await db.refresh(evaluation)
    return evaluation


@router.get(
    "/{employee_id}/scorecard",
    response_model=EmployeeScorecardResponse,
    summary="Current competency scorecard for a probationary employee",
)
async def get_scorecard(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeScorecardResponse:
    """Return the latest competency scores, target, and gaps."""
    employee = await _get_scoped_employee(db, employee_id, current_user)
    latest = await _latest_evaluation(db, employee.id, current_user.organization_id)

    scores = _scores_from_evaluation(latest) if latest is not None else {}

    competencies = [
        CompetencyScoreItem(
            key=attribute,
            label=label,
            score=scores.get(attribute, 0.0),
            target=TARGET_SCORE,
            gap=round(scores.get(attribute, 0.0) - TARGET_SCORE, 2),
        )
        for attribute, label in COMPETENCIES
    ]

    if latest is not None:
        overall_score = round(float(latest.overall_score), 2)
        latest_evaluation_date: Optional[date] = latest.evaluation_date
    else:
        overall_score = 0.0
        latest_evaluation_date = None

    return EmployeeScorecardResponse(
        employee_id=employee.id,
        overall_score=overall_score,
        target_score=TARGET_SCORE,
        gap=round(overall_score - TARGET_SCORE, 2),
        competencies=competencies,
        latest_evaluation_date=latest_evaluation_date,
    )


@router.get(
    "/{employee_id}/audit-trail",
    response_model=list[AuditLogItemResponse],
    summary="Append-only competency audit trail (newest first)",
)
async def get_audit_trail(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AuditLogItemResponse]:
    """Return every immutable competency audit entry, newest first."""
    employee = await _get_scoped_employee(db, employee_id, current_user)

    stmt = (
        select(EvaluationAuditLog)
        .options(selectinload(EvaluationAuditLog.evaluator))
        .where(
            EvaluationAuditLog.employee_id == employee.id,
            EvaluationAuditLog.organization_id == current_user.organization_id,
        )
        .order_by(EvaluationAuditLog.created_at.desc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [
        AuditLogItemResponse(
            id=log.id,
            competency=log.competency,
            evaluator_name=log.evaluator.full_name if log.evaluator else "Unknown",
            prior_score=log.prior_score,
            new_score=log.new_score,
            created_at=log.created_at,
        )
        for log in logs
    ]


__all__ = ["router"]
