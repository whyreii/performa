"""Guardrail: Gemini writes only the summary + rationales; never the intervention set.

The catalog mapping is deterministic (flagged competencies, score < 3.0). Gemini
output cannot add, drop, or reorder interventions.
"""
from __future__ import annotations

import pytest

from backend.gemini import FALLBACK_SUMMARY
from backend.ml.catalog import COMPETENCIES, get_catalog, recommend_courses
from backend.tests.helpers import EMPLOYER_EMAIL, find_employee_id, login_user


async def _rollup(client, employer, emp_id, score):
    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={c: score for c in COMPETENCIES},
    )
    return await client.post(
        f"/api/interventions/{emp_id}/monthly-rollup?month_number=2", headers=employer
    )


@pytest.mark.asyncio
async def test_gemini_timeout_saves_catalog_items_with_empty_rationales(client, monkeypatch):
    import backend.routers.interventions as interventions

    async def fake(*args, **kwargs):
        return FALLBACK_SUMMARY, {}

    monkeypatch.setattr(interventions, "generate_performance_rationales", fake)

    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    resp = await _rollup(client, employer, emp_id, 2.0)
    assert resp.status_code == 201, resp.text

    plans = (await client.get("/api/interventions/pending", headers=employer)).json()
    assert plans and all(p["status"] == "pending_approval" for p in plans)
    assert all(not p["rationale"] for p in plans), "fallback rationales must be empty"


@pytest.mark.asyncio
async def test_adversarial_gemini_cannot_change_the_intervention_set(client, monkeypatch):
    import backend.routers.interventions as interventions

    async def fake(*args, **kwargs):
        return "Injected.", {"BOGUS-ID": "ignore me"}

    monkeypatch.setattr(interventions, "generate_performance_rationales", fake)

    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    resp = await _rollup(client, employer, emp_id, 2.0)
    assert resp.status_code == 201, resp.text

    plans = (await client.get("/api/interventions/pending", headers=employer)).json()
    catalog_ids = {p["catalog_id"] for p in plans}
    assert "BOGUS-ID" not in catalog_ids, "Gemini must not add interventions"
    assert catalog_ids, "deterministic catalog items must still be saved"


@pytest.mark.asyncio
async def test_low_scores_map_deterministically_to_catalog(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    resp = await _rollup(client, employer, emp_id, 2.0)
    assert resp.status_code == 201, resp.text

    plans = (await client.get("/api/interventions/pending", headers=employer)).json()
    saved = {p["catalog_id"] for p in plans}
    expected = {
        str(course.get("catalog_id") or course.get("course_id"))
        for competency in COMPETENCIES
        for course in recommend_courses(competency)
    }
    assert expected, "the catalog must contain courses"
    assert saved == expected, "all 5 competencies below 3.0 map to the full catalog set"

    catalog_competencies = {entry["competency"] for entry in get_catalog()}
    assert catalog_competencies <= set(COMPETENCIES)


@pytest.mark.asyncio
async def test_no_flagged_competency_produces_no_interventions(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    before = (await client.get("/api/interventions/pending", headers=employer)).json()
    resp = await _rollup(client, employer, emp_id, 5.0)
    assert resp.status_code == 201, resp.text
    after = (await client.get("/api/interventions/pending", headers=employer)).json()
    assert len(after) == len(before), "all scores >= 3.0 => no interventions"
