"""Weekly KPI evaluations, scorecards, and the append-only audit trail.

All lookups are strictly scoped to ``current_user.organization_id``. Rating
submissions are restricted to employers and supervisors; probationary
employees may only read their own scorecard and audit trail.

Audit entries are append-only: one immutable ``EvaluationAuditLog`` row is
written per competency whose score changed or was set for the first time.
"""
from __future__ import annotations

import html
import logging
import uuid
from datetime import timedelta
from statistics import fmean
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user, require_role
from ..audit import record_activity
from ..database import get_db
from ..gemini import generate_performance_rationales
from ..ml.predictor import predict_employee_risk
from ..models import (
    EvaluationAuditLog,
    KpiRubric,
    PerformanceRatingEnum,
    ProbationaryEmployee,
    RegularizationRecommendation,
    User,
    UserRole,
    WeeklyEvaluation,
)
from ..schemas import (
    AuditLogItemResponse,
    CompetencyScoreItem,
    EmployeeScorecardResponse,
    RegularizationRecommendationResponse,
    RiskExplanationResponse,
    TrendPoint,
    WeeklyEvaluationResponse,
    WeeklyRatingSubmit,
)
from ..timeutils import manila_today

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Evaluations"])

REGULARIZATION_HORIZON_DAYS = 150

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


def _rating_from_tier(value: str) -> PerformanceRatingEnum:
    """Coerce a predicted tier label to the stored enum, with a safe default."""
    try:
        return PerformanceRatingEnum(value)
    except ValueError:
        logger.warning("Unknown predicted tier %r; defaulting to Needs Improvement", value)
        return PerformanceRatingEnum.NEEDS_IMPROVEMENT


async def _get_scoped_employee(
    db: AsyncSession,
    employee_id: uuid.UUID,
    current_user: User,
) -> ProbationaryEmployee:
    """Fetch an employee within the caller's tenant, enforcing self-access."""
    stmt = (
        select(ProbationaryEmployee)
        .options(selectinload(ProbationaryEmployee.user))
        .where(
            ProbationaryEmployee.id == employee_id,
            ProbationaryEmployee.organization_id == current_user.organization_id,
        )
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
    if current_user.role == UserRole.SUPERVISOR and employee.supervisor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisors may only access employees assigned to them",
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

    evaluation_date_value = manila_today()
    week_number = max(1, ((evaluation_date_value - employee.start_date).days // 7) + 1)

    evaluation = WeeklyEvaluation(
        employee_id=employee.id,
        evaluator_id=current_user.id,
        organization_id=current_user.organization_id,
        evaluation_date=evaluation_date_value,
        week_number=week_number,
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

    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="evaluation.submit",
        entity_type="evaluation",
        entity_id=evaluation.id,
        detail=f"overall={overall_score}",
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
    if latest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluations recorded for this employee",
        )

    scores = _scores_from_evaluation(latest)

    rubrics = list(
        (
            await db.execute(
                select(KpiRubric).where(
                    KpiRubric.organization_id == current_user.organization_id
                )
            )
        )
        .scalars()
        .all()
    )
    target_map = {rubric.competency.value: float(rubric.target_score) for rubric in rubrics}
    weight_map = {rubric.competency.value: float(rubric.weight) for rubric in rubrics}

    competencies = [
        CompetencyScoreItem(
            key=attribute,
            label=label,
            score=scores[attribute],
            target=target_map.get(attribute, TARGET_SCORE),
            gap=round(scores[attribute] - target_map.get(attribute, TARGET_SCORE), 2),
        )
        for attribute, label in COMPETENCIES
    ]

    total_weight = sum(weight_map.values())
    if total_weight > 0:
        overall_target = sum(
            weight_map.get(attribute, 0.0) * target_map.get(attribute, TARGET_SCORE)
            for attribute, _ in COMPETENCIES
        ) / total_weight
    else:
        overall_target = TARGET_SCORE

    overall_score = round(float(latest.overall_score), 2)

    return EmployeeScorecardResponse(
        employee_id=employee.id,
        overall_score=overall_score,
        target_score=round(overall_target, 2),
        gap=round(overall_score - overall_target, 2),
        competencies=competencies,
        latest_evaluation_date=latest.evaluation_date,
    )


@router.get(
    "/{employee_id}/risk-explanation",
    response_model=RiskExplanationResponse,
    summary="ML risk explanation with feature importances",
)
async def get_risk_explanation(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RiskExplanationResponse:
    """Explain the latest classification, including per-competency importance."""
    employee = await _get_scoped_employee(db, employee_id, current_user)
    latest = await _latest_evaluation(db, employee.id, current_user.organization_id)
    if latest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluations recorded for this employee",
        )

    try:
        result = predict_employee_risk(_scores_from_evaluation(latest))
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    return RiskExplanationResponse(**result)


@router.get(
    "/{employee_id}/trend",
    response_model=list[TrendPoint],
    summary="Monthly KPI trend for a probationary employee",
)
async def get_kpi_trend(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TrendPoint]:
    """Aggregate weekly evaluations into monthly competency trend points."""
    employee = await _get_scoped_employee(db, employee_id, current_user)

    stmt = (
        select(WeeklyEvaluation)
        .where(
            WeeklyEvaluation.employee_id == employee.id,
            WeeklyEvaluation.organization_id == current_user.organization_id,
        )
        .order_by(WeeklyEvaluation.evaluation_date.asc())
    )
    evaluations = list((await db.execute(stmt)).scalars().all())
    if not evaluations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluations recorded for this employee",
        )

    buckets: dict[int, list[WeeklyEvaluation]] = {}
    for evaluation in evaluations:
        days = (evaluation.evaluation_date - employee.start_date).days
        month = max(1, ((days - 1) // 30) + 1)
        buckets.setdefault(month, []).append(evaluation)

    points: list[TrendPoint] = []
    for month in sorted(buckets):
        group = buckets[month]
        scores = {
            attribute: fmean(float(getattr(item, attribute)) for item in group)
            for attribute, _ in COMPETENCIES
        }
        points.append(
            TrendPoint(
                month_number=month,
                period_start=employee.start_date + timedelta(days=(month - 1) * 30),
                period_end=employee.start_date + timedelta(days=month * 30),
                overall_average=fmean(scores.values()),
                **scores,
            )
        )
    return points


@router.post(
    "/{employee_id}/regularization-recommendation",
    response_model=RegularizationRecommendationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an AI-assisted regularization recommendation (mid-5th month)",
)
async def create_regularization_recommendation(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> RegularizationRecommendation:
    """Aggregate the first 150 days of evaluations into a decision-support output."""
    employee = await _get_scoped_employee(db, employee_id, current_user)

    horizon = employee.start_date + timedelta(days=REGULARIZATION_HORIZON_DAYS)
    stmt = select(WeeklyEvaluation).where(
        WeeklyEvaluation.employee_id == employee.id,
        WeeklyEvaluation.organization_id == current_user.organization_id,
        WeeklyEvaluation.evaluation_date <= horizon,
    )
    evaluations = list((await db.execute(stmt)).scalars().all())
    if not evaluations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluations recorded within the first 150 days",
        )

    scores = {
        attribute: fmean(float(getattr(evaluation, attribute)) for evaluation in evaluations)
        for attribute, _ in COMPETENCIES
    }
    try:
        prediction = predict_employee_risk(scores)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    tier = str(prediction["predicted_tier"])
    recommendation = (
        "Regularize"
        if tier == PerformanceRatingEnum.MEETS_EXPECTATIONS.value
        else "Do Not Regularize"
    )

    rationale, _ = await generate_performance_rationales(
        employee_name=employee.user.full_name if employee.user else "",
        month_number=5,
        status_classification=tier,
        competency_scores=scores,
        recommended_courses=[],
    )

    record = RegularizationRecommendation(
        employee_id=employee.id,
        organization_id=current_user.organization_id,
        month_number=5,
        status_classification=_rating_from_tier(tier),
        overall_average=fmean(scores.values()),
        recommendation=recommendation,
        rationale=rationale,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get(
    "/{employee_id}/regularization-recommendation",
    response_model=RegularizationRecommendationResponse,
    summary="Latest regularization recommendation for an employee",
)
async def get_regularization_recommendation(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RegularizationRecommendation:
    """Return the most recent regularization recommendation, if any."""
    employee = await _get_scoped_employee(db, employee_id, current_user)
    stmt = (
        select(RegularizationRecommendation)
        .where(
            RegularizationRecommendation.employee_id == employee.id,
            RegularizationRecommendation.organization_id == current_user.organization_id,
        )
        .order_by(RegularizationRecommendation.created_at.desc())
        .limit(1)
    )
    record = (await db.execute(stmt)).scalar_one_or_none()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No regularization recommendation has been generated",
        )
    return record


@router.get(
    "/{employee_id}/report",
    response_class=HTMLResponse,
    summary="Printable performance report (HTML)",
)
async def get_employee_report(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HTMLResponse:
    """Render a print-ready HTML performance report for an employee."""
    employee = await _get_scoped_employee(db, employee_id, current_user)
    latest = await _latest_evaluation(db, employee.id, current_user.organization_id)

    name = html.escape(employee.user.full_name if employee.user else "Employee")

    if latest is not None:
        rows = "".join(
            f"<tr><td>{label}</td>"
            f"<td style='text-align:right'>{float(getattr(latest, attribute)):.1f}</td></tr>"
            for attribute, label in COMPETENCIES
        )
        overall_row = (
            "<tr class='total'><td>Overall Average</td>"
            f"<td style='text-align:right'>{float(latest.overall_score):.2f}</td></tr>"
        )
        latest_date = latest.evaluation_date.isoformat()
    else:
        rows = "<tr><td colspan='2'>No evaluations recorded.</td></tr>"
        overall_row = ""
        latest_date = "—"

    document = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Performa Report — {name}</title>
<style>
  body {{ font-family: system-ui, -apple-system, sans-serif; margin: 40px; color: #1a1714; }}
  h1 {{ font-size: 22px; margin-bottom: 4px; }}
  .meta {{ color: #57524d; font-size: 13px; margin: 12px 0 20px; line-height: 1.6; }}
  table {{ border-collapse: collapse; width: 100%; max-width: 640px; }}
  th, td {{ border: 1px solid #ddd; padding: 8px 10px; font-size: 14px; }}
  th {{ background: #f6f3ed; text-align: left; }}
  .total td {{ font-weight: 700; }}
  @media print {{ .no-print {{ display: none; }} }}
</style></head>
<body>
  <h1>Performa — Probationary Performance Report</h1>
  <div class="meta">
    <div><strong>{name}</strong></div>
    <div>{html.escape(employee.job_title)} · {html.escape(employee.department)}</div>
    <div>Start: {employee.start_date.isoformat()} · Day 180: {employee.day_180_date.isoformat()} · Status: {employee.status.value}</div>
    <div>Latest evaluation: {latest_date}</div>
  </div>
  <table>
    <thead><tr><th>Competency</th><th style="text-align:right">Score (1–5)</th></tr></thead>
    <tbody>{rows}{overall_row}</tbody>
  </table>
  <p class="no-print" style="margin-top:24px">
    <button onclick="window.print()">Print / Save as PDF</button>
  </p>
</body></html>"""
    return HTMLResponse(content=document)


@router.get(
    "/audit-trail",
    response_model=list[AuditLogItemResponse],
    summary="Tenant-wide competency audit trail (newest first)",
)
async def get_tenant_audit_trail(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.EMPLOYER)),
) -> list[AuditLogItemResponse]:
    """Return immutable competency audit entries in the tenant, newest first."""
    stmt = (
        select(EvaluationAuditLog)
        .options(selectinload(EvaluationAuditLog.evaluator))
        .where(EvaluationAuditLog.organization_id == current_user.organization_id)
        .order_by(EvaluationAuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
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
