"""Intervention plans, monthly rollups, Random Forest ML, and notifications tests."""
from __future__ import annotations

import pytest

from backend.ml.catalog import COMPETENCIES
from backend.tests.helpers import (
    EMP1_EMAIL,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    find_employee_id,
    login_user,
)


@pytest.mark.asyncio
async def test_my_interventions_is_self_scoped(client):
    """The /mine endpoint returns only approved interventions for the authenticated employee."""
    employee = await login_user(client, EMP1_EMAIL)
    response = await client.get("/api/interventions/mine", headers=employee)
    assert response.status_code == 200, response.text
    plans = response.json()
    assert isinstance(plans, list)

    employer = await login_user(client, EMPLOYER_EMAIL)
    no_profile = await client.get("/api/interventions/mine", headers=employer)
    assert no_profile.status_code == 404


@pytest.mark.asyncio
async def test_pending_requires_employer_role(client):
    """The /pending interventions endpoint is restricted to Employer and Admin roles."""
    employee = await login_user(client, EMP1_EMAIL)
    response = await client.get("/api/interventions/pending", headers=employee)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_supervisor_can_list_pending_interventions(client):
    """Supervisors can view pending interventions to monitor assigned employee development."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    response = await client.get("/api/interventions/pending", headers=supervisor)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_rollup_month_filter_and_idempotency(client):
    """Monthly rollup uses a non-overlapping month window and is idempotent."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    carlos_id = await find_employee_id(client, employer, "Carlos Early")

    low = {
        "task_completion": 2.0,
        "attendance_and_punctuality": 2.0,
        "communication_and_teamwork": 3.0,
        "initiative_and_adaptability": 3.0,
        "quality_of_work": 2.0,
    }
    created = await client.post(
        f"/api/evaluations/{carlos_id}/weekly", headers=employer, json=low
    )
    assert created.status_code == 201, created.text

    # Carlos is seeded at day 30, so the boundary evaluation belongs to month 2 only.
    month_1 = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=1", headers=employer
    )
    assert month_1.status_code == 404, "day-30 boundary must not be counted in month 1"

    first = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=2", headers=employer
    )
    assert first.status_code == 201, first.text

    pending_first = (await client.get("/api/interventions/pending", headers=employer)).json()
    assert len(pending_first) == 6  # 3 flagged competencies x 2 courses

    # Re-running must update in place, not duplicate.
    second = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=2", headers=employer
    )
    assert second.status_code == 201, second.text
    pending_second = (await client.get("/api/interventions/pending", headers=employer)).json()
    assert len(pending_second) == 6, "rollup is not idempotent"

    # A month with no evaluations in its window is rejected.
    missing = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=4", headers=employer
    )
    assert missing.status_code == 404, missing.text


@pytest.mark.asyncio
async def test_rollup_regeneration_preserves_evidentiary_state(client):
    """Regenerating a dispatched/acknowledged month is blocked to preserve records."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    carlos_id = await find_employee_id(client, employer, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 3.0 for competency in COMPETENCIES},
    )
    rollup = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=2", headers=employer
    )
    assert rollup.status_code == 201, rollup.text
    summary_id = rollup.json()["id"]

    dispatch = await client.post(
        f"/api/interventions/summaries/{summary_id}/dispatch", headers=employer
    )
    assert dispatch.status_code == 200, dispatch.text
    employee = await login_user(client, EMP1_EMAIL)
    ack = await client.post(
        f"/api/interventions/summaries/{summary_id}/acknowledge", headers=employee
    )
    assert ack.status_code == 200, ack.text

    # Re-running after dispatch/acknowledgement must be refused (409), not wipe records.
    rerun = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=2", headers=employer
    )
    assert rerun.status_code == 409, rerun.text

    mine = await client.get("/api/interventions/summaries/mine", headers=employee)
    assert mine.status_code == 200
    assert mine.json()[0]["acknowledged_at"], "acknowledgement must be preserved"


@pytest.mark.asyncio
async def test_risk_explanation_includes_feature_importances(client):
    """Risk explanation returns risk tier and non-empty feature importances from Random Forest."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    carlos_id = await find_employee_id(client, employer, "Carlos Early")

    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 3.5 for competency in COMPETENCIES},
    )

    response = await client.get(
        f"/api/evaluations/{carlos_id}/risk-explanation", headers=employer
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "predicted_tier" in data
    assert "confidence" in data
    assert "feature_importances" in data
    assert len(data["feature_importances"]) > 0


@pytest.mark.asyncio
async def test_regularization_recommendation(client):
    """Regularization decision support generates a recommendation once Day 150 is reached."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    # Maria Midterm is seeded at Day 152, past the Day 150 statutory horizon.
    maria_id = await find_employee_id(client, employer, "Maria Midterm")
    await client.post(
        f"/api/evaluations/{maria_id}/weekly",
        headers=employer,
        json={competency: 4.5 for competency in COMPETENCIES},
    )

    created = await client.post(
        f"/api/evaluations/{maria_id}/regularization-recommendation", headers=employer
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["month_number"] == 5
    assert body["recommendation"] in ("Regularize", "Do Not Regularize")

    fetched = await client.get(
        f"/api/evaluations/{maria_id}/regularization-recommendation", headers=employer
    )
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


@pytest.mark.asyncio
async def test_regularization_recommendation_requires_day_150(client):
    """Before Day 150 the mid-5th-month recommendation is refused (400)."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    carlos_id = await find_employee_id(client, employer, "Carlos Early")  # seeded at Day 30
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 4.5 for competency in COMPETENCIES},
    )

    response = await client.post(
        f"/api/evaluations/{carlos_id}/regularization-recommendation", headers=employer
    )
    assert response.status_code == 400, response.text
    assert "150 days" in response.json()["detail"]


@pytest.mark.asyncio
async def test_rollup_requires_active_employee(client):
    """Monthly rollups are refused for non-active (terminated) employees (400)."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    carlos_id = await find_employee_id(client, employer, "Carlos Early")

    terminated = await client.patch(
        f"/api/employees/{carlos_id}/status",
        headers=employer,
        json={"status": "terminated", "reason": "Article 296 non-regularization."},
    )
    assert terminated.status_code == 200, terminated.text

    response = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=1", headers=employer
    )
    assert response.status_code == 400, response.text
    assert "active" in response.json()["detail"]


@pytest.mark.asyncio
async def test_regularization_recommendation_requires_evaluations(client):
    """Regularization recommendation returns 404 if employee has no weekly evaluations."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    maria_id = await find_employee_id(client, employer, "Maria Midterm")

    response = await client.post(
        f"/api/evaluations/{maria_id}/regularization-recommendation", headers=employer
    )
    assert response.status_code == 404, response.text


@pytest.mark.asyncio
async def test_monthly_summary_dispatch_and_acknowledge(client):
    """Employer dispatches monthly summary, employee receives and acknowledges it."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    carlos_id = await find_employee_id(client, employer, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 3.5 for competency in COMPETENCIES},
    )
    rollup = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=2", headers=employer
    )
    assert rollup.status_code == 201, rollup.text
    summary_id = rollup.json()["id"]

    employee = await login_user(client, EMP1_EMAIL)
    before = await client.get("/api/interventions/summaries/mine", headers=employee)
    assert before.status_code == 200 and before.json() == []

    dispatch = await client.post(
        f"/api/interventions/summaries/{summary_id}/dispatch", headers=employer
    )
    assert dispatch.status_code == 200, dispatch.text
    assert dispatch.json()["dispatched_at"]

    mine = await client.get("/api/interventions/summaries/mine", headers=employee)
    assert mine.status_code == 200 and len(mine.json()) == 1

    ack = await client.post(
        f"/api/interventions/summaries/{summary_id}/acknowledge", headers=employee
    )
    assert ack.status_code == 200, ack.text
    assert ack.json()["acknowledged_at"]


@pytest.mark.asyncio
async def test_notifications_created_on_dispatch(client):
    """Dispatching a monthly summary generates in-app notifications for the employee."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    carlos_id = await find_employee_id(client, employer, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 3.5 for competency in COMPETENCIES},
    )
    rollup = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=2", headers=employer
    )
    assert rollup.status_code == 201, rollup.text
    summary_id = rollup.json()["id"]
    await client.post(
        f"/api/interventions/summaries/{summary_id}/dispatch", headers=employer
    )

    employee = await login_user(client, EMP1_EMAIL)
    notes = await client.get("/api/notifications", headers=employee)
    assert notes.status_code == 200, notes.text
    assert len(notes.json()) >= 1
    notification_id = notes.json()[0]["id"]

    read = await client.post(
        f"/api/notifications/{notification_id}/read", headers=employee
    )
    assert read.status_code == 200, read.text
    assert read.json()["is_read"] is True


@pytest.mark.asyncio
async def test_printable_report(client):
    """Evaluation report endpoint returns printable HTML containing employee and score data."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    carlos_id = await find_employee_id(client, supervisor, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=supervisor,
        json={competency: 4.0 for competency in COMPETENCIES},
    )
    response = await client.get(f"/api/evaluations/{carlos_id}/report", headers=supervisor)
    assert response.status_code == 200, response.text
    assert "text/html" in response.headers["content-type"]
    assert "Carlos Early" in response.text
