"""Shared performance-scoring math.

The single source for the tenant's *weighted regularizing target* — the 4.0
statutory standard adjusted by each KPI rubric's target and weight. The
per-employee scorecard and the employee-list summary both read it from here so
the two can never disagree (AGENTS.md §1.2, docs/LAYOUT_GRAMMAR.md "one source").
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .domain import TARGET_SCORE
from .ml.catalog import COMPETENCIES
from .models import KpiRubric


async def rubric_maps(
    db: AsyncSession, organization_id: str
) -> tuple[dict[str, float], dict[str, float]]:
    """Per-competency ``(targets, weights)`` for the tenant, keyed by competency."""
    rubrics = list(
        (
            await db.execute(
                select(KpiRubric).where(KpiRubric.organization_id == organization_id)
            )
        )
        .scalars()
        .all()
    )
    targets = {rubric.competency.value: float(rubric.target_score) for rubric in rubrics}
    weights = {rubric.competency.value: float(rubric.weight) for rubric in rubrics}
    return targets, weights


def weighted_target(targets: dict[str, float], weights: dict[str, float]) -> float:
    """The tenant's weighted regularizing target; the statutory 4.0 when unweighted."""
    total = sum(weights.values())
    if total <= 0:
        return TARGET_SCORE
    return sum(
        weights.get(attribute, 0.0) * targets.get(attribute, TARGET_SCORE)
        for attribute in COMPETENCIES
    ) / total
