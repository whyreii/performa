"""Weekly KPI evaluations, scorecard gap calculations, and immutable audit trail tests."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from backend.ml.catalog import COMPETENCIES
from backend.tests.helpers import (
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    find_employee_id,
    login_user,
)


@pytest.mark.asyncio
async def test_scorecard_contract(client):
    """Scorecard returns competencies as an array of structured items with targets and gaps."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")

    scores = {competency: 4.0 for competency in COMPETENCIES}
    created = await client.post(
        f"/api/evaluations/{emp_id}/weekly", headers=supervisor, json=scores
    )
    assert created.status_code == 201, created.text

    response = await client.get(f"/api/evaluations/{emp_id}/scorecard", headers=supervisor)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "competencies" in data
    assert isinstance(data["competencies"], list)
    assert len(data["competencies"]) == 5
    for comp in data["competencies"]:
        assert "key" in comp
        assert "label" in comp
        assert "score" in comp
        assert "target" in comp
        assert "gap" in comp
        assert comp["target"] == 4.0


@pytest.mark.asyncio
async def test_scorecard_404_when_no_evaluations(client):
    """An employee with zero weekly evaluations yields 404 on the scorecard endpoint."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    maria_id = await find_employee_id(client, employer, "Maria Midterm")

    response = await client.get(
        f"/api/evaluations/{maria_id}/scorecard", headers=employer
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_audit_trail_contract(client):
    """Audit trail items contain evaluator_name, competency, prior_score, and new_score."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")

    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=supervisor,
        json={competency: 3.5 for competency in COMPETENCIES},
    )

    response = await client.get(f"/api/evaluations/{emp_id}/audit-trail", headers=supervisor)
    assert response.status_code == 200, response.text
    logs = response.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1
    sample = logs[0]
    assert "evaluator_name" in sample
    assert "competency" in sample
    assert "prior_score" in sample
    assert "new_score" in sample
    assert sample["evaluator_name"] != "Unknown"


@pytest.mark.asyncio
async def test_tenant_audit_trail_pagination(client):
    """Tenant-wide audit trail endpoint supports skip and limit pagination parameters."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")

    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={competency: 4.0 for competency in COMPETENCIES},
    )

    limited = await client.get(
        "/api/evaluations/audit-trail?skip=0&limit=1", headers=employer
    )
    assert limited.status_code == 200, limited.text
    assert len(limited.json()) == 1


@pytest.mark.asyncio
async def test_supervisor_cannot_rate_unassigned_employee(client):
    """A supervisor cannot rate an employee assigned to someone else (yields 403)."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)
    unassigned_id = await find_employee_id(client, employer, "Pedro Notice")

    response = await client.post(
        f"/api/evaluations/{unassigned_id}/weekly",
        headers=supervisor,
        json={competency: 3.5 for competency in COMPETENCIES},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_kpi_rubrics_defaults_and_update(client):
    """Customizable KPI rubric targets and weights can be updated and reset."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    rubrics = await client.get("/api/kpi-rubrics", headers=employer)
    assert rubrics.status_code == 200, rubrics.text
    items = rubrics.json()
    assert len(items) == 5

    update = await client.put(
        "/api/kpi-rubrics/task_completion",
        headers=employer,
        json={"target_score": 4.5, "weight": 0.25},
    )
    assert update.status_code == 200, update.text
    assert update.json()["target_score"] == 4.5

    reset = await client.post("/api/kpi-rubrics/reset", headers=employer)
    assert reset.status_code == 200, reset.text
    first = reset.json()[0]
    assert first["target_score"] == 4.0


@pytest.mark.asyncio
async def test_kpi_rubrics_bulk_save_is_atomic(client):
    """Bulk save applies every row in one transaction; a zero total is rejected."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    await client.get("/api/kpi-rubrics", headers=employer)  # provision defaults

    # Moving all weight onto one competency is a legal final state and must be
    # accepted as a single write (the per-row path could transiently hit 0).
    moved = [
        {"competency": c, "target_score": 4.0, "weight": 1.0 if c == "quality_of_work" else 0.0}
        for c in COMPETENCIES
    ]
    ok = await client.put("/api/kpi-rubrics", headers=employer, json={"items": moved})
    assert ok.status_code == 200, ok.text
    weights = {r["competency"]: float(r["weight"]) for r in ok.json()}
    assert weights["quality_of_work"] == 1.0
    assert sum(weights.values()) == 1.0

    # A payload that would zero the org is rejected and nothing changes.
    zeroed = [{"competency": c, "target_score": 4.0, "weight": 0.0} for c in COMPETENCIES]
    bad = await client.put("/api/kpi-rubrics", headers=employer, json={"items": zeroed})
    assert bad.status_code == 422, bad.text
    after = await client.get("/api/kpi-rubrics", headers=employer)
    assert {r["competency"]: float(r["weight"]) for r in after.json()} == weights


@pytest.mark.asyncio
async def test_kpi_trend(client):
    """The trend endpoint returns chronological monthly competency averages."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    carlos_id = await find_employee_id(client, supervisor, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=supervisor,
        json={competency: 4.0 for competency in COMPETENCIES},
    )

    response = await client.get(
        f"/api/evaluations/{carlos_id}/trend", headers=supervisor
    )
    assert response.status_code == 200, response.text
    points = response.json()
    assert len(points) >= 1
    assert points[0]["month_number"] == 2
    assert set(COMPETENCIES) <= set(points[0])


@pytest.mark.asyncio
async def test_weekly_rating_rejects_future_date(client):
    """A weekly rating dated in the future is refused (400)."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")

    future = (date.today() + timedelta(days=5)).isoformat()
    payload = {competency: 4.0 for competency in COMPETENCIES}
    payload["evaluation_date"] = future

    response = await client.post(
        f"/api/evaluations/{emp_id}/weekly", headers=supervisor, json=payload
    )
    assert response.status_code == 400, response.text
    assert "future" in response.json()["detail"]


@pytest.mark.asyncio
async def test_weekly_remarks_are_returned(client):
    """Behavioral remarks submitted with a rating are retrievable from the record."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")

    payload = {competency: 4.0 for competency in COMPETENCIES}
    payload["remarks"] = "Strong week; delivered the Q3 reconciliation ahead of schedule."
    created = await client.post(
        f"/api/evaluations/{emp_id}/weekly", headers=supervisor, json=payload
    )
    assert created.status_code == 201, created.text

    response = await client.get(f"/api/evaluations/{emp_id}/weekly", headers=supervisor)
    assert response.status_code == 200, response.text
    rows = response.json()
    assert rows, "expected at least one weekly evaluation"
    assert rows[0]["remarks"] == "Strong week; delivered the Q3 reconciliation ahead of schedule."
    assert rows[0]["evaluator_name"] and rows[0]["evaluator_name"] != "Unknown"
