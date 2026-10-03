"""Wave 5 feature tests (E9 explainability, E10 profile update, E14 KPI rubrics)."""
from __future__ import annotations

from backend.ml.catalog import COMPETENCIES

DEFAULT_PASSWORD = "Password123!"


async def _login(client, email: str, password: str = DEFAULT_PASSWORD):
    response = await client.post(
        "/api/auth/login", data={"username": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _find_employee(client, headers, full_name: str) -> str:
    response = await client.get("/api/employees/", headers=headers)
    assert response.status_code == 200, response.text
    return next(
        emp["id"] for emp in response.json() if emp["user"]["full_name"] == full_name
    )


async def test_risk_explanation_includes_feature_importances(client):
    supervisor = await _login(client, "supervisor@acme.com")
    carlos_id = await _find_employee(client, supervisor, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=supervisor,
        json={competency: 3.0 for competency in COMPETENCIES},
    )

    response = await client.get(
        f"/api/evaluations/{carlos_id}/risk-explanation", headers=supervisor
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body["feature_importances"]) == set(COMPETENCIES)
    assert 0.0 <= body["confidence"] <= 1.0
    assert abs(sum(body["feature_importances"].values()) - 1.0) < 0.05


async def test_profile_self_update(client):
    headers = await _login(client, "emp1@acme.com")
    response = await client.patch(
        "/api/auth/me", headers=headers, json={"full_name": "Carlos Updated"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "Carlos Updated"

    conflict = await client.patch(
        "/api/auth/me", headers=headers, json={"email": "supervisor@acme.com"}
    )
    assert conflict.status_code == 409, conflict.text


async def test_kpi_rubrics_defaults_and_update(client):
    employer = await _login(client, "employer@acme.com")
    listing = await client.get("/api/kpi-rubrics", headers=employer)
    assert listing.status_code == 200, listing.text
    rubrics = listing.json()
    assert {r["competency"] for r in rubrics} == set(COMPETENCIES)
    assert all(r["target_score"] == 4.0 and r["weight"] == 0.2 for r in rubrics)

    updated = await client.put(
        "/api/kpi-rubrics/quality_of_work",
        headers=employer,
        json={"target_score": 4.5, "weight": 0.3},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["target_score"] == 4.5

    templates = await client.get("/api/kpi-rubrics/templates", headers=employer)
    assert templates.status_code == 200
    assert "retail" in templates.json()


async def test_regularization_recommendation(client):
    employer = await _login(client, "employer@acme.com")
    carlos_id = await _find_employee(client, employer, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 4.5 for competency in COMPETENCIES},
    )

    created = await client.post(
        f"/api/evaluations/{carlos_id}/regularization-recommendation", headers=employer
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["month_number"] == 5
    assert body["recommendation"] in ("Regularize", "Do Not Regularize")

    fetched = await client.get(
        f"/api/evaluations/{carlos_id}/regularization-recommendation", headers=employer
    )
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


async def test_regularization_recommendation_requires_evaluations(client):
    employer = await _login(client, "employer@acme.com")
    maria_id = await _find_employee(client, employer, "Maria Midterm")
    response = await client.post(
        f"/api/evaluations/{maria_id}/regularization-recommendation", headers=employer
    )
    assert response.status_code == 404, response.text


async def test_monthly_summary_dispatch_and_acknowledge(client):
    employer = await _login(client, "employer@acme.com")
    carlos_id = await _find_employee(client, employer, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 3.5 for competency in COMPETENCIES},
    )
    rollup = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=1", headers=employer
    )
    assert rollup.status_code == 201, rollup.text
    summary_id = rollup.json()["id"]

    employee = await _login(client, "emp1@acme.com")
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


async def test_activity_log_records_and_is_admin_only(client):
    admin = await _login(client, "admin@acme.com")
    created = await client.post(
        "/api/admin/users",
        headers=admin,
        json={
            "email": "activity@acme.com",
            "full_name": "Activity User",
            "password": DEFAULT_PASSWORD,
            "role": "supervisor",
        },
    )
    assert created.status_code == 201, created.text

    response = await client.get("/api/admin/activity", headers=admin)
    assert response.status_code == 200, response.text
    actions = {entry["action"] for entry in response.json()}
    assert "auth.login" in actions
    assert "user.create" in actions

    employee = await _login(client, "emp1@acme.com")
    forbidden = await client.get("/api/admin/activity", headers=employee)
    assert forbidden.status_code == 403


async def test_kpi_trend(client):
    supervisor = await _login(client, "supervisor@acme.com")
    carlos_id = await _find_employee(client, supervisor, "Carlos Early")
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
    assert points[0]["month_number"] == 1
    assert set(COMPETENCIES) <= set(points[0])


async def test_notifications_created_on_dispatch(client):
    employer = await _login(client, "employer@acme.com")
    carlos_id = await _find_employee(client, employer, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 3.5 for competency in COMPETENCIES},
    )
    rollup = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=1", headers=employer
    )
    assert rollup.status_code == 201, rollup.text
    summary_id = rollup.json()["id"]
    await client.post(
        f"/api/interventions/summaries/{summary_id}/dispatch", headers=employer
    )

    employee = await _login(client, "emp1@acme.com")
    notes = await client.get("/api/notifications", headers=employee)
    assert notes.status_code == 200, notes.text
    assert len(notes.json()) >= 1
    notification_id = notes.json()[0]["id"]

    read = await client.post(
        f"/api/notifications/{notification_id}/read", headers=employee
    )
    assert read.status_code == 200, read.text
    assert read.json()["is_read"] is True
