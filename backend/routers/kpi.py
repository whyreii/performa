"""KPI rubric configuration (targets and weights) per tenant.

Employers configure the target score and weight for each of the five fixed
competencies; employers and supervisors may view them. Defaults (target 4.0,
weight 0.20) are provisioned lazily per organization and can be reset.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_role
from ..database import get_db
from ..ml.catalog import COMPETENCIES
from ..models import CompetencyEnum, KpiRubric, User, UserRole
from ..schemas import KpiRubricBulkUpsert, KpiRubricResponse, KpiRubricUpsert

router = APIRouter(prefix="/api/kpi-rubrics", tags=["KPI Rubrics"])

DEFAULT_TARGET = 4.0
DEFAULT_WEIGHT = 0.20

# Industry KPI template library (weights sum to 1.0 per template).
INDUSTRY_TEMPLATES: dict[str, dict[str, dict[str, float]]] = {
    "retail": {
        "task_completion": {"target_score": 4.0, "weight": 0.25},
        "attendance_and_punctuality": {"target_score": 4.0, "weight": 0.25},
        "communication_and_teamwork": {"target_score": 4.0, "weight": 0.20},
        "initiative_and_adaptability": {"target_score": 4.0, "weight": 0.10},
        "quality_of_work": {"target_score": 4.0, "weight": 0.20},
    },
    "bpo": {
        "task_completion": {"target_score": 4.0, "weight": 0.25},
        "attendance_and_punctuality": {"target_score": 4.0, "weight": 0.20},
        "communication_and_teamwork": {"target_score": 4.5, "weight": 0.25},
        "initiative_and_adaptability": {"target_score": 4.0, "weight": 0.10},
        "quality_of_work": {"target_score": 4.5, "weight": 0.20},
    },
    "food_service": {
        "task_completion": {"target_score": 4.0, "weight": 0.20},
        "attendance_and_punctuality": {"target_score": 4.0, "weight": 0.25},
        "communication_and_teamwork": {"target_score": 4.0, "weight": 0.20},
        "initiative_and_adaptability": {"target_score": 4.0, "weight": 0.15},
        "quality_of_work": {"target_score": 4.0, "weight": 0.20},
    },
    "logistics": {
        "task_completion": {"target_score": 4.0, "weight": 0.30},
        "attendance_and_punctuality": {"target_score": 4.0, "weight": 0.25},
        "communication_and_teamwork": {"target_score": 4.0, "weight": 0.15},
        "initiative_and_adaptability": {"target_score": 4.0, "weight": 0.10},
        "quality_of_work": {"target_score": 4.0, "weight": 0.20},
    },
    "construction": {
        "task_completion": {"target_score": 4.0, "weight": 0.25},
        "attendance_and_punctuality": {"target_score": 4.0, "weight": 0.25},
        "communication_and_teamwork": {"target_score": 4.0, "weight": 0.15},
        "initiative_and_adaptability": {"target_score": 4.0, "weight": 0.15},
        "quality_of_work": {"target_score": 4.5, "weight": 0.20},
    },
}


async def _ensure_defaults(db: AsyncSession, organization_id: str) -> list[KpiRubric]:
    """Return the tenant's rubrics, provisioning defaults on first access."""
    existing = list(
        (
            await db.execute(
                select(KpiRubric).where(KpiRubric.organization_id == organization_id)
            )
        )
        .scalars()
        .all()
    )
    if existing:
        return existing

    rows = [
        KpiRubric(
            organization_id=organization_id,
            competency=CompetencyEnum(competency),
            target_score=DEFAULT_TARGET,
            weight=DEFAULT_WEIGHT,
        )
        for competency in COMPETENCIES
    ]
    db.add_all(rows)
    await db.commit()
    for row in rows:
        await db.refresh(row)
    return rows


@router.get("", response_model=list[KpiRubricResponse], summary="List KPI rubrics")
async def list_rubrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.EMPLOYER, UserRole.SUPERVISOR)
    ),
) -> list[KpiRubric]:
    """Return the tenant's competency targets and weights."""
    return await _ensure_defaults(db, current_user.organization_id)


@router.get("/templates", summary="Industry KPI template library")
async def list_templates(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return the pre-built KPI templates by industry."""
    return INDUSTRY_TEMPLATES


@router.put(
    "/{competency}",
    response_model=KpiRubricResponse,
    summary="Set a competency's target and weight",
)
async def upsert_rubric(
    competency: CompetencyEnum,
    payload: KpiRubricUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> KpiRubric:
    """Create or update the rubric for a single competency."""
    # Provision the tenant's defaults first so the total-weight guard always sees
    # the full five-row set; otherwise a first write on a fresh org would look
    # like an isolated row and a legitimate zero-weight write could be rejected.
    await _ensure_defaults(db, current_user.organization_id)

    # Scoring normalizes by the TOTAL weight (routers/evaluations.py), so a total
    # of 0 silently falls back to the unweighted mean and ignores the employer's
    # configuration. Reject any write that would leave the organization at 0.
    other_total = (
        await db.execute(
            select(func.sum(KpiRubric.weight)).where(
                KpiRubric.organization_id == current_user.organization_id,
                KpiRubric.competency != competency,
            )
        )
    ).scalar_one_or_none() or 0.0
    if float(other_total) + float(payload.weight) <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Total weight must be greater than 0 — at least one competency "
                "must keep a non-zero weight."
            ),
        )

    rubric = (
        await db.execute(
            select(KpiRubric).where(
                KpiRubric.organization_id == current_user.organization_id,
                KpiRubric.competency == competency,
            )
        )
    ).scalar_one_or_none()

    if rubric is None:
        rubric = KpiRubric(
            organization_id=current_user.organization_id,
            competency=competency,
            target_score=payload.target_score,
            weight=payload.weight,
        )
        db.add(rubric)
    else:
        rubric.target_score = payload.target_score
        rubric.weight = payload.weight

    await db.commit()
    await db.refresh(rubric)
    return rubric


@router.put(
    "",
    response_model=list[KpiRubricResponse],
    summary="Set several competency targets/weights atomically",
)
async def bulk_upsert_rubrics(
    payload: KpiRubricBulkUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> list[KpiRubric]:
    """Apply a set of rubric changes in one transaction.

    The full set is validated before anything is written: if the resulting total
    weight would be 0 the request is rejected (422) and no row changes. This
    removes the half-applied saves and transient-zero rejections the
    five-parallel-PUT UI path could produce.
    """
    rows = {
        row.competency: row
        for row in await _ensure_defaults(db, current_user.organization_id)
    }

    proposed = {competency: float(row.weight) for competency, row in rows.items()}
    for item in payload.items:
        proposed[item.competency] = float(item.weight)
    if sum(proposed.values()) <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Total weight must be greater than 0 — at least one competency "
                "must keep a non-zero weight."
            ),
        )

    for item in payload.items:
        row = rows[item.competency]
        row.target_score = item.target_score
        row.weight = item.weight
    await db.commit()
    for row in rows.values():
        await db.refresh(row)

    return [rows[CompetencyEnum(competency)] for competency in COMPETENCIES]


@router.post(
    "/reset",
    response_model=list[KpiRubricResponse],
    summary="Reset rubrics to platform defaults",
)
async def reset_rubrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> list[KpiRubric]:
    """Delete the tenant's rubrics and re-provision the defaults."""
    await db.execute(
        delete(KpiRubric).where(KpiRubric.organization_id == current_user.organization_id)
    )
    await db.flush()
    return await _ensure_defaults(db, current_user.organization_id)


__all__ = ["router"]
