"""Employer-defined custom KPIs: CRUD, rating, and the deterministic pipeline.

Custom KPIs are non-statutory. These tests lock in that they never enter the
five-competency score or the audit chain, and that a mapped, sub-3.0 custom KPI
raises its catalog course deterministically (Gemini only explains it).
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from backend.database import async_session_maker
from backend.ml.catalog import COMPETENCIES, get_catalog, rank_courses_by_text
from backend.models import CustomKpiRating
from backend.tests.helpers import (
    ADMIN_EMAIL,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    find_employee_id,
    login_user,
)


def _catalog_ids() -> set[str]:
    return {str(c.get("catalog_id") or c.get("course_id")) for c in get_catalog()}


def test_rank_courses_by_text_is_deterministic_and_ranks_catalog():
    first = rank_courses_by_text("How well he/she talks to the client")
    second = rank_courses_by_text("How well he/she talks to the client")
    assert first == second, "matching must be deterministic"
    assert len(first) == len(get_catalog())
    scores = [c["_match_score"] for c in first]
    assert scores == sorted(scores, reverse=True)


async def _create_kpi(client, employer, name: str, mapped: str | None = None) -> dict:
    resp = await client.post(
        "/api/custom-kpis",
        headers=employer,
        json={"name": name, "mapped_catalog_id": mapped},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _assign_kpi(client, employer, employee_id: str, kpi_ids: list[str]) -> dict:
    """Set which custom KPIs this employee is rated on (the onboarding step)."""
    resp = await client.put(
        f"/api/custom-kpis/employees/{employee_id}",
        headers=employer,
        json={"custom_kpi_ids": kpi_ids},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_employer_can_create_and_list(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    kpi = await _create_kpi(client, employer, "How well he/she talks to the client")
    assert kpi["name"] == "How well he/she talks to the client"
    assert kpi["is_active"] is True

    listing = await client.get("/api/custom-kpis", headers=employer)
    assert listing.status_code == 200
    assert [k["id"] for k in listing.json()] == [kpi["id"]]


@pytest.mark.asyncio
async def test_duplicate_name_is_rejected(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    await _create_kpi(client, employer, "Client Rapport")
    dup = await client.post(
        "/api/custom-kpis", headers=employer, json={"name": "client rapport"}
    )
    assert dup.status_code == 409, dup.text


@pytest.mark.asyncio
async def test_supervisor_cannot_write_and_admin_is_denied(client):
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    admin = await login_user(client, ADMIN_EMAIL)

    create = await client.post(
        "/api/custom-kpis", headers=supervisor, json={"name": "Nope"}
    )
    assert create.status_code == 403, create.text

    admin_list = await client.get("/api/custom-kpis", headers=admin)
    assert admin_list.status_code == 403, admin_list.text


@pytest.mark.asyncio
async def test_suggest_course_returns_a_catalog_course(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    resp = await client.post(
        "/api/custom-kpis/suggest-course",
        headers=employer,
        json={"name": "How well he/she talks to the client"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["suggested_catalog_id"] in _catalog_ids()
    assert isinstance(body["alternatives"], list)


@pytest.mark.asyncio
async def test_unknown_catalog_mapping_is_rejected(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    resp = await client.post(
        "/api/custom-kpis",
        headers=employer,
        json={"name": "Bad Map", "mapped_catalog_id": "NOT-A-COURSE"},
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_weekly_rating_stores_custom_kpi_without_changing_overall(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    kpi = await _create_kpi(client, employer, "Client Rapport")
    await _assign_kpi(client, employer, emp_id, [kpi["id"]])

    resp = await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={
            **{c: 4.0 for c in COMPETENCIES},
            "custom_kpi_ratings": [{"custom_kpi_id": kpi["id"], "score": 2.0}],
        },
    )
    assert resp.status_code == 201, resp.text
    # The statutory overall is the mean of the five competencies only.
    assert resp.json()["overall_score"] == 4.0

    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(CustomKpiRating).where(
                    CustomKpiRating.custom_kpi_id == uuid.UUID(kpi["id"])
                )
            )
        ).scalars().all()
    assert len(rows) == 1 and rows[0].score == 2.0


@pytest.mark.asyncio
async def test_unknown_custom_kpi_in_weekly_rating_is_rejected(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    resp = await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={
            **{c: 4.0 for c in COMPETENCIES},
            "custom_kpi_ratings": [
                {
                    "custom_kpi_id": "00000000-0000-0000-0000-000000000000",
                    "score": 2.0,
                }
            ],
        },
    )
    assert resp.status_code == 400, resp.text


@pytest.mark.asyncio
async def test_low_mapped_custom_kpi_raises_its_course_deterministically(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    kpi = await _create_kpi(client, employer, "Client Rapport", mapped="TC-101")
    await _assign_kpi(client, employer, emp_id, [kpi["id"]])

    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={
            **{c: 5.0 for c in COMPETENCIES},  # no competency is flagged
            "custom_kpi_ratings": [{"custom_kpi_id": kpi["id"], "score": 2.0}],
        },
    )
    rollup = await client.post(
        f"/api/interventions/{emp_id}/monthly-rollup?month_number=2", headers=employer
    )
    assert rollup.status_code == 201, rollup.text

    plans = (await client.get("/api/interventions/pending", headers=employer)).json()
    assert [p["catalog_id"] for p in plans] == ["TC-101"]
    assert plans[0]["custom_kpi_name"] == "Client Rapport"


@pytest.mark.asyncio
async def test_high_custom_kpi_raises_no_course(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    kpi = await _create_kpi(client, employer, "Client Rapport", mapped="TC-101")
    await _assign_kpi(client, employer, emp_id, [kpi["id"]])

    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={
            **{c: 5.0 for c in COMPETENCIES},
            "custom_kpi_ratings": [{"custom_kpi_id": kpi["id"], "score": 4.5}],
        },
    )
    await client.post(
        f"/api/interventions/{emp_id}/monthly-rollup?month_number=2", headers=employer
    )
    plans = (await client.get("/api/interventions/pending", headers=employer)).json()
    assert plans == []


@pytest.mark.asyncio
async def test_assignment_caps_at_five(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    kpis = [await _create_kpi(client, employer, f"KPI {i}") for i in range(6)]

    over = await client.put(
        f"/api/custom-kpis/employees/{emp_id}",
        headers=employer,
        json={"custom_kpi_ids": [k["id"] for k in kpis]},
    )
    assert over.status_code == 422, over.text

    ok = await client.put(
        f"/api/custom-kpis/employees/{emp_id}",
        headers=employer,
        json={"custom_kpi_ids": [k["id"] for k in kpis[:5]]},
    )
    assert ok.status_code == 200, ok.text
    assert len(ok.json()["custom_kpi_ids"]) == 5


@pytest.mark.asyncio
async def test_unassigned_custom_kpi_cannot_be_rated(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    assigned = await _create_kpi(client, employer, "Assigned KPI")
    unassigned = await _create_kpi(client, employer, "Unassigned KPI")
    await _assign_kpi(client, employer, emp_id, [assigned["id"]])

    resp = await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={
            **{c: 4.0 for c in COMPETENCIES},
            "custom_kpi_ratings": [{"custom_kpi_id": unassigned["id"], "score": 2.0}],
        },
    )
    assert resp.status_code == 400, resp.text
    assert "not assigned" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_assignment_rejects_an_unknown_kpi(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    resp = await client.put(
        f"/api/custom-kpis/employees/{emp_id}",
        headers=employer,
        json={"custom_kpi_ids": ["00000000-0000-0000-0000-000000000000"]},
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_assignment_is_readable_by_the_supervisor(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    kpi = await _create_kpi(client, employer, "Client Rapport")
    await _assign_kpi(client, employer, emp_id, [kpi["id"]])

    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    resp = await client.get(f"/api/custom-kpis/employees/{emp_id}", headers=supervisor)
    assert resp.status_code == 200, resp.text
    assert resp.json()["custom_kpi_ids"] == [kpi["id"]]


@pytest.mark.asyncio
async def test_supervisor_cannot_change_an_assignment(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    resp = await client.put(
        f"/api/custom-kpis/employees/{emp_id}",
        headers=supervisor,
        json={"custom_kpi_ids": []},
    )
    assert resp.status_code == 403, resp.text


def test_gemini_prompt_tags_custom_kpi_band_and_course_link():
    from backend.gemini import _build_prompt

    prompt = _build_prompt(
        employee_name="Ana Urgent",
        month_number=1,
        status_classification="Meets Expectations",
        competency_scores={c: 4.0 for c in COMPETENCIES},
        recommended_courses=[
            {
                "catalog_id": "CT-102",
                "competency": "communication_and_teamwork",
                "title": "Clear Escalation & Active Listening",
                "description": "Structured escalation and listening drills.",
            }
        ],
        custom_kpi_scores={
            "Client Escalation Responsiveness": 2.0,
            "CRM Hygiene": 3.5,
            "Product Knowledge": 4.5,
        },
        custom_course_names={"CT-102": "Client Escalation Responsiveness"},
    )
    assert (
        '"Client Escalation Responsiveness": 2.00/5.0 '
        "(below 3.0 gap threshold — requires the mapped training intervention)"
    ) in prompt
    assert '"CRM Hygiene": 3.50/5.0 (3.0–3.99 developing)' in prompt
    assert '"Product Knowledge": 4.50/5.0 (4.0+ meets expectations)' in prompt
    assert 'catalog_id=CT-102; raised_by_custom_kpi="Client Escalation Responsiveness"' in prompt

