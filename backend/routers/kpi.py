"""KPI rubric configuration (targets and weights) per tenant.

Employers and admins may configure the target score and weight for each of the
five fixed competencies. Defaults (target 4.0, weight 0.20) are provisioned
lazily per organization and can be reset.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_role
from ..database import get_db
from ..ml.catalog import COMPETENCIES
from ..models import CompetencyEnum, KpiRubric, User, UserRole
from ..schemas import KpiRubricResponse, KpiRubricUpsert

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
        require_role(UserRole.ADMIN, UserRole.EMPLOYER, UserRole.SUPERVISOR)
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
