"""Guardrail: KPI weights can never leave an organization with nothing to weigh.

Scoring normalizes by the total weight (``routers/evaluations.py``), so weights
are *relative* and need not sum to 1.0. But if every weight is 0 the total is 0,
and the code silently falls back to the unweighted mean — the employer's
configuration is ignored with no error. The per-competency PUT validates each
field in isolation (``0 <= weight <= 1``), so nothing stops this state today.

The invariant: after any sequence of accepted PUTs, the organization's total
weight is > 0 — either a request is rejected, or the weights are not all zero.
"""
from __future__ import annotations

import pytest

from backend.ml.catalog import COMPETENCIES
from backend.tests.helpers import EMPLOYER_EMAIL, login_user


@pytest.mark.asyncio
async def test_org_can_never_end_up_with_zero_total_weight(client):
    employer = await login_user(client, EMPLOYER_EMAIL)

    for competency in COMPETENCIES:
        resp = await client.put(
            f"/api/kpi-rubrics/{competency}",
            headers=employer,
            json={"target_score": 4.0, "weight": 0.0},
        )
        assert resp.status_code in (200, 422), resp.text

    listing = await client.get("/api/kpi-rubrics", headers=employer)
    assert listing.status_code == 200, listing.text
    total = sum(float(r["weight"]) for r in listing.json())
    assert total > 0, (
        "all five weights were accepted as 0, so scoring silently ignores the "
        "employer's configuration (falls back to the unweighted mean). Reject "
        "the write that would zero the total, or add a bulk endpoint that "
        "validates the whole set."
    )
