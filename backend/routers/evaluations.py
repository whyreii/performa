"""Weekly KPI evaluations, scorecards, and the append-only audit trail.

All lookups are strictly scoped to ``current_user.organization_id``. Rating
submissions are restricted to employers and supervisors; probationary
employees may only read their own scorecard and audit trail.

Audit entries are append-only: one immutable ``EvaluationAuditLog`` row is
written per competency whose score changed or was set for the first time.
"""
from __future__ import annotations

import csv
import html
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO
from statistics import fmean
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from xhtml2pdf import pisa

from ..auth import get_current_user, require_role
from ..audit import record_activity
from ..audit_chain import audit_record_hash
from ..database import get_db
from ..domain import (
    REGULARIZATION_HORIZON_DAYS,
    TARGET_SCORE,
    month_number_for,
    month_window,
)
from ..gemini import generate_performance_rationales
from ..ml.catalog import COMPETENCY_LABELS
from ..ml.explain import explain_prediction
from ..ml.predictor import predict_employee_risk
from ..models import (
    EvaluationAuditLog,
    MonthlySummary,
    PerformanceRatingEnum,
    ProbationaryEmployee,
    ProbationStatus,
    RegularizationRecommendation,
    TrainingPlan,
    User,
    UserRole,
    WeeklyEvaluation,
)
from ..schemas import (
    AuditChainVerificationResponse,
    AuditLogItemResponse,
    CompetencyScoreItem,
    EmployeeScorecardResponse,
    RegularizationRecommendationResponse,
    RiskExplanationResponse,
    TrendPoint,
    WeeklyEvaluationListItem,
    WeeklyEvaluationResponse,
    WeeklyRatingSubmit,
)
from ..scoring import rubric_maps, weighted_target
from ..timeutils import manila_today, to_manila

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Evaluations"])

# (model attribute, human-readable label) for the five fixed categories, derived
# from the ML catalog so the keys are defined in exactly one place.
COMPETENCIES: tuple[tuple[str, str], ...] = tuple(COMPETENCY_LABELS.items())


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
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted for current role",
        )
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


async def _latest_audit_hash(
    db: AsyncSession,
    employee_id: uuid.UUID,
    organization_id: str,
) -> Optional[str]:
    """The ``record_hash`` of the employee's most recent hashed audit row."""
    stmt = (
        select(EvaluationAuditLog.record_hash)
        .where(
            EvaluationAuditLog.employee_id == employee_id,
            EvaluationAuditLog.organization_id == organization_id,
            EvaluationAuditLog.record_hash.isnot(None),
        )
        .order_by(EvaluationAuditLog.created_at.desc(), EvaluationAuditLog.id.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


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

    if employee.status != ProbationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Weekly ratings can only be recorded for active probationary employees.",
        )

    evaluation_date_value = payload.evaluation_date or manila_today()
    if not (employee.start_date <= evaluation_date_value <= employee.day_180_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "evaluation_date must fall within the employee's probationary period "
                f"({employee.start_date.isoformat()} to {employee.day_180_date.isoformat()})."
            ),
        )

    today = manila_today()
    if evaluation_date_value > min(today, employee.day_180_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "evaluation_date cannot be in the future "
                f"(latest allowed is {today.isoformat()})."
            ),
        )

    previous = await _latest_evaluation(db, employee.id, current_user.organization_id)
    prior_scores = _scores_from_evaluation(previous) if previous is not None else {}
    new_scores = _scores_from_payload(payload)

    overall_score = round(sum(new_scores.values()) / len(new_scores), 2)

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

    # Tamper-evident chain: each row hashes its predecessor's hash. Explicit,
    # strictly-increasing timestamps make the per-employee chain verifiable.
    previous_hash = await _latest_audit_hash(
        db, employee.id, current_user.organization_id
    )
    base_time = datetime.now(timezone.utc)
    chain_index = 0
    for attribute, _label in COMPETENCIES:
        prior_score = prior_scores.get(attribute)
        new_score = new_scores[attribute]
        if prior_score is None or prior_score != new_score:
            created_at = base_time + timedelta(microseconds=chain_index)
            chain_index += 1
            record_hash = audit_record_hash(
                previous_hash,
                current_user.organization_id,
                employee.id,
                current_user.id,
                attribute,
                prior_score,
                new_score,
                created_at,
            )
            db.add(
                EvaluationAuditLog(
                    employee_id=employee.id,
                    evaluator_id=current_user.id,
                    organization_id=current_user.organization_id,
                    competency=attribute,
                    prior_score=prior_score,
                    new_score=new_score,
                    created_at=created_at,
                    prev_hash=previous_hash,
                    record_hash=record_hash,
                )
            )
            previous_hash = record_hash

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

    target_map, weight_map = await rubric_maps(db, current_user.organization_id)

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

    overall_target = weighted_target(target_map, weight_map)
    total_weight = sum(weight_map.values())
    if total_weight > 0:
        # Compare like-for-like: a weighted target must be measured against a
        # weighted score, not the unweighted mean.
        weighted_score = sum(
            weight_map.get(attribute, 0.0) * scores[attribute]
            for attribute, _ in COMPETENCIES
        ) / total_weight
    else:
        weighted_score = float(latest.overall_score)

    overall_score = round(float(latest.overall_score), 2)

    return EmployeeScorecardResponse(
        employee_id=employee.id,
        overall_score=overall_score,
        target_score=round(overall_target, 2),
        gap=round(weighted_score - overall_target, 2),
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

    scores = _scores_from_evaluation(latest)
    try:
        result = predict_employee_risk(scores)
        explanation = explain_prediction(scores)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI risk model is unavailable. Please contact the administrator.",
        )

    return RiskExplanationResponse(**result, **explanation)


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
        # Align with the monthly-rollup window: month n = [start+(n-1)*30, start+n*30-1].
        month = month_number_for(employee.start_date, evaluation.evaluation_date)
        buckets.setdefault(month, []).append(evaluation)

    points: list[TrendPoint] = []
    for month in sorted(buckets):
        group = buckets[month]
        scores = {
            attribute: fmean(float(getattr(item, attribute)) for item in group)
            for attribute, _ in COMPETENCIES
        }
        period_start, period_end = month_window(employee.start_date, month)
        points.append(
            TrendPoint(
                month_number=month,
                period_start=period_start,
                period_end=period_end,
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

    days_elapsed = (manila_today() - employee.start_date).days
    if days_elapsed < REGULARIZATION_HORIZON_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Regularization recommendations require at least 150 days of "
                "probation elapsed under Article 296."
            ),
        )

    # Under Article 296 the mid-5th-month review targets the Day 150 milestone.
    # For employees at or past Day 150 (Days 151-180), include all evaluations up
    # to today so milestone reviews still incorporate late-entered ratings.
    horizon = max(
        employee.start_date + timedelta(days=REGULARIZATION_HORIZON_DAYS),
        manila_today(),
    )
    stmt = select(WeeklyEvaluation).where(
        WeeklyEvaluation.employee_id == employee.id,
        WeeklyEvaluation.organization_id == current_user.organization_id,
        WeeklyEvaluation.evaluation_date <= horizon,
    )
    evaluations = list((await db.execute(stmt)).scalars().all())
    if not evaluations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No weekly evaluations recorded for this employee. At least one "
                "weekly rating is required before generating AI regularization "
                "decision support."
            ),
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
            detail="AI risk model is unavailable. Please contact the administrator.",
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

    # Idempotent: one recommendation per employee (regenerate in place).
    existing = (
        await db.execute(
            select(RegularizationRecommendation).where(
                RegularizationRecommendation.employee_id == employee.id,
                RegularizationRecommendation.organization_id == current_user.organization_id,
            )
        )
    ).scalars().first()

    if existing is not None:
        existing.month_number = 5
        existing.status_classification = _rating_from_tier(tier)
        existing.overall_average = fmean(scores.values())
        existing.recommendation = recommendation
        existing.rationale = rationale
        record = existing
    else:
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


def _html_to_pdf(document: str) -> bytes:
    """Render the report HTML to PDF bytes (xhtml2pdf / ReportLab)."""
    buffer = BytesIO()
    result = pisa.CreatePDF(src=document, dest=buffer, encoding="utf-8")
    if getattr(result, "err", 0):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to render the PDF report.",
        )
    return buffer.getvalue()


async def _render_report_html(
    db: AsyncSession, employee: ProbationaryEmployee, organization_id: str
) -> str:
    """Build the full print-ready performance report (HTML) for one employee.

    Contains the manuscript's report set: latest competency scores, complete
    monthly rollups, AI training recommendations, and the regularization
    decision record, plus recent behavioral remarks.
    """
    latest = await _latest_evaluation(db, employee.id, organization_id)
    name = html.escape(employee.user.full_name if employee.user else "Employee")

    if latest is not None:
        rows = "".join(
            f"<tr><td>{label}</td><td class='r'>{float(getattr(latest, attribute)):.1f}</td></tr>"
            for attribute, label in COMPETENCIES
        )
        overall_row = (
            "<tr class='total'><td>Overall Average</td>"
            f"<td class='r'>{float(latest.overall_score):.2f}</td></tr>"
        )
        latest_date = latest.evaluation_date.isoformat()
    else:
        rows = "<tr><td colspan='2'>No evaluations recorded.</td></tr>"
        overall_row = ""
        latest_date = "—"

    # Complete monthly rollups.
    summaries = list(
        (
            await db.execute(
                select(MonthlySummary)
                .where(MonthlySummary.employee_id == employee.id)
                .order_by(MonthlySummary.month_number)
            )
        )
        .scalars()
        .all()
    )
    monthly_html = (
        "<table><thead><tr><th>Cycle</th><th class='r'>Overall average</th>"
        "<th>Classification</th></tr></thead><tbody>"
        + "".join(
            f"<tr><td>Month {s.month_number}</td>"
            f"<td class='r'>{float(s.overall_average):.2f}</td>"
            f"<td>{html.escape(s.status_classification.value if s.status_classification else '—')}</td></tr>"
            for s in summaries
        )
        + "</tbody></table>"
        if summaries
        else "<p class='meta'>No monthly rollups recorded.</p>"
    )

    # AI-generated training recommendations.
    plans = list(
        (
            await db.execute(
                select(TrainingPlan)
                .where(TrainingPlan.employee_id == employee.id)
                .order_by(TrainingPlan.created_at)
            )
        )
        .scalars()
        .all()
    )
    plans_html = (
        "<table><thead><tr><th>Recommendation</th><th>Competency</th>"
        "<th>Status</th></tr></thead><tbody>"
        + "".join(
            f"<tr><td>{html.escape(p.intervention_title)}</td>"
            f"<td>{html.escape(p.competency)}</td>"
            f"<td>{html.escape(p.status.value)}</td></tr>"
            for p in plans
        )
        + "</tbody></table>"
        if plans
        else "<p class='meta'>No training recommendations recorded.</p>"
    )

    # Regularization decision record (most recent, if any).
    reg = (
        await db.execute(
            select(RegularizationRecommendation)
            .where(
                RegularizationRecommendation.employee_id == employee.id,
                RegularizationRecommendation.organization_id == organization_id,
            )
            .order_by(RegularizationRecommendation.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    reg_html = (
        "<table><tbody>"
        f"<tr><td>Recommendation</td><td>{html.escape(reg.recommendation)}</td></tr>"
        f"<tr><td>Classification</td><td>{html.escape(reg.status_classification.value)}</td></tr>"
        f"<tr><td>Overall average</td><td>{float(reg.overall_average):.2f} / 5.0</td></tr>"
        + (
            f"<tr><td>Rationale</td><td>{html.escape(reg.rationale)}</td></tr>"
            if reg.rationale
            else ""
        )
        + "</tbody></table>"
        if reg
        else "<p class='meta'>No regularization recommendation recorded.</p>"
    )

    # Recent behavioral remarks.
    remarks_stmt = (
        select(WeeklyEvaluation)
        .where(
            WeeklyEvaluation.employee_id == employee.id,
            WeeklyEvaluation.organization_id == organization_id,
            WeeklyEvaluation.remarks.isnot(None),
        )
        .order_by(WeeklyEvaluation.evaluation_date.desc())
        .limit(5)
    )
    remark_rows = (await db.execute(remarks_stmt)).scalars().all()
    remarks_html = (
        "".join(
            "<div class='rem'>"
            f"<div class='rd'>{row.evaluation_date.isoformat()}</div>"
            f"<div>{html.escape(row.remarks or '')}</div>"
            "</div>"
            for row in remark_rows
        )
        if remark_rows
        else "<p class='meta'>No behavioral remarks recorded.</p>"
    )

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Performa Report — {name}</title>
<style>
  @page {{ margin: 2cm; }}
  body {{ font-family: Helvetica, Arial, sans-serif; color: #1a1714; font-size: 12px; }}
  h1 {{ font-size: 20px; margin-bottom: 4px; }}
  h2 {{ font-size: 14px; margin: 22px 0 6px; }}
  .meta {{ color: #57524d; font-size: 11px; margin: 10px 0 16px; line-height: 1.6; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid #cccccc; padding: 6px 8px; font-size: 11px; }}
  th {{ background: #f0ece6; text-align: left; }}
  .r {{ text-align: right; }}
  .total td {{ font-weight: bold; }}
  .rem {{ border-top: 1px solid #eeeeee; padding: 6px 0; }}
  .rd {{ color: #57524d; font-size: 10px; }}
</style></head>
<body>
  <h1>Performa — Probationary Performance Report</h1>
  <div class="meta">
    <div><strong>{name}</strong></div>
    <div>{html.escape(employee.job_title)} · {html.escape(employee.department)}</div>
    <div>Start: {employee.start_date.isoformat()} · Day 180: {employee.day_180_date.isoformat()} · Status: {employee.status.value}</div>
    <div>Latest evaluation: {latest_date}</div>
  </div>
  <h2>Latest competency scores</h2>
  <table><thead><tr><th>Competency</th><th class="r">Score (1–5)</th></tr></thead>
  <tbody>{rows}{overall_row}</tbody></table>
  <h2>Monthly rollups</h2>
  {monthly_html}
  <h2>AI training recommendations</h2>
  {plans_html}
  <h2>Regularization decision record</h2>
  {reg_html}
  <h2>Supervisor remarks</h2>
  {remarks_html}
</body></html>"""


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
    document = await _render_report_html(db, employee, current_user.organization_id)
    return HTMLResponse(content=document)


@router.get(
    "/{employee_id}/report.pdf",
    summary="Performance report (PDF download)",
)
async def get_employee_report_pdf(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Render the performance report as a downloadable PDF file."""
    employee = await _get_scoped_employee(db, employee_id, current_user)
    document = await _render_report_html(db, employee, current_user.organization_id)
    pdf_bytes = _html_to_pdf(document)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="performa-report-{employee.id}.pdf"'
        },
    )


@router.get(
    "/{employee_id}/weekly",
    response_model=list[WeeklyEvaluationListItem],
    summary="Weekly ratings and behavioral remarks (newest first)",
)
async def list_weekly_evaluations(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WeeklyEvaluationListItem]:
    """Return weekly evaluations with the evaluator's behavioral remarks, newest first."""
    employee = await _get_scoped_employee(db, employee_id, current_user)

    stmt = (
        select(WeeklyEvaluation)
        .options(selectinload(WeeklyEvaluation.evaluator))
        .where(
            WeeklyEvaluation.employee_id == employee.id,
            WeeklyEvaluation.organization_id == current_user.organization_id,
        )
        .order_by(
            WeeklyEvaluation.evaluation_date.desc(),
            WeeklyEvaluation.created_at.desc(),
        )
    )
    rows = (await db.execute(stmt)).scalars().all()

    return [
        WeeklyEvaluationListItem(
            id=row.id,
            evaluation_date=row.evaluation_date,
            week_number=row.week_number,
            evaluator_name=row.evaluator.full_name if row.evaluator else "Evaluator",
            overall_score=row.overall_score,
            remarks=row.remarks,
        )
        for row in rows
    ]


@router.get(
    "/audit-trail",
    response_model=list[AuditLogItemResponse],
    summary="Tenant-wide competency audit trail (newest first)",
)
async def get_tenant_audit_trail(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> list[AuditLogItemResponse]:
    """Return immutable competency audit entries in the tenant, newest first."""
    stmt = (
        select(EvaluationAuditLog)
        .options(
            selectinload(EvaluationAuditLog.evaluator),
            selectinload(EvaluationAuditLog.employee).selectinload(ProbationaryEmployee.user),
        )
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
            employee_name=(
                log.employee.user.full_name
                if log.employee and log.employee.user
                else "Unknown"
            ),
            prior_score=log.prior_score,
            new_score=log.new_score,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get(
    "/audit-trail.csv",
    summary="Download the tenant audit trail as CSV (Employer)",
    response_class=Response,
)
async def export_tenant_audit_trail_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> Response:
    """Download every immutable audit entry for the tenant as CSV (newest first)."""
    stmt = (
        select(EvaluationAuditLog)
        .options(
            selectinload(EvaluationAuditLog.evaluator),
            selectinload(EvaluationAuditLog.employee).selectinload(ProbationaryEmployee.user),
        )
        .where(EvaluationAuditLog.organization_id == current_user.organization_id)
        .order_by(EvaluationAuditLog.created_at.desc())
    )
    logs = (await db.execute(stmt)).scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Recorded (Asia/Manila)",
            "Employee",
            "Competency",
            "Evaluator",
            "Prior score",
            "New score",
        ]
    )
    for log in logs:
        writer.writerow(
            [
                to_manila(log.created_at).strftime("%Y-%m-%d %H:%M"),
                (log.employee.user.full_name if log.employee and log.employee.user else "Unknown"),
                log.competency,
                (log.evaluator.full_name if log.evaluator else "Unknown"),
                "" if log.prior_score is None else f"{float(log.prior_score):.2f}",
                f"{float(log.new_score):.2f}",
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit-trail.csv"'},
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
            employee_name=employee.user.full_name if employee.user else None,
            prior_score=log.prior_score,
            new_score=log.new_score,
            created_at=log.created_at,
        )
        for log in logs
    ]


def _verify_audit_chain(
    rows: list[EvaluationAuditLog],
) -> tuple[bool, Optional[uuid.UUID], int]:
    """Recompute the per-employee hash chain; return (valid, broken_id, checked)."""
    running: Optional[str] = None
    checked = 0
    for row in rows:
        if row.record_hash is None:
            continue
        expected = audit_record_hash(
            running,
            row.organization_id,
            row.employee_id,
            row.evaluator_id,
            row.competency,
            row.prior_score,
            row.new_score,
            row.created_at,
        )
        if row.prev_hash != running or expected != row.record_hash:
            return False, row.id, checked
        running = row.record_hash
        checked += 1
    return True, None, checked


@router.get(
    "/{employee_id}/audit-trail/verify",
    response_model=AuditChainVerificationResponse,
    summary="Verify the tamper-evident audit hash chain",
)
async def verify_audit_chain(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AuditChainVerificationResponse:
    """Recompute the hash chain and report the first broken record, if any."""
    employee = await _get_scoped_employee(db, employee_id, current_user)
    stmt = (
        select(EvaluationAuditLog)
        .where(
            EvaluationAuditLog.employee_id == employee.id,
            EvaluationAuditLog.organization_id == current_user.organization_id,
        )
        .order_by(EvaluationAuditLog.created_at.asc(), EvaluationAuditLog.id.asc())
    )
    rows = list((await db.execute(stmt)).scalars().all())
    valid, broken_id, checked = _verify_audit_chain(rows)
    return AuditChainVerificationResponse(
        valid=valid, checked=checked, first_broken_id=broken_id
    )


__all__ = ["router"]
