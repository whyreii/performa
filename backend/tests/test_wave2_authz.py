"""Wave 2 (P1) authorization, scoping, and account tests."""
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


async def test_supervisor_cannot_rate_unassigned_employee(client):
    employer = await _login(client, "employer@acme.com")
    # Ana Urgent has no supervisor assigned in the seed data
    ana_id = await _find_employee(client, employer, "Ana Urgent")

    supervisor = await _login(client, "supervisor@acme.com")
    response = await client.post(
        f"/api/evaluations/{ana_id}/weekly",
        headers=supervisor,
        json={competency: 4.0 for competency in COMPETENCIES},
    )
    assert response.status_code == 403, response.text

    scorecard = await client.get(
        f"/api/evaluations/{ana_id}/scorecard", headers=supervisor
    )
    assert scorecard.status_code == 403, scorecard.text


async def test_scorecard_404_when_no_evaluations(client):
    employer = await _login(client, "employer@acme.com")
    maria_id = await _find_employee(client, employer, "Maria Midterm")

    response = await client.get(f"/api/evaluations/{maria_id}/scorecard", headers=employer)
    assert response.status_code == 404, response.text


async def test_terminate_requires_reason(client):
    employer = await _login(client, "employer@acme.com")
    carlos_id = await _find_employee(client, employer, "Carlos Early")

    missing = await client.patch(
        f"/api/employees/{carlos_id}/status",
        headers=employer,
        json={"status": "terminated"},
    )
    assert missing.status_code == 400, missing.text

    ok = await client.patch(
        f"/api/employees/{carlos_id}/status",
        headers=employer,
        json={"status": "terminated", "reason": "Documented underperformance"},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "terminated"
    assert ok.json()["status_reason"] == "Documented underperformance"


async def test_change_password_flow(client):
    headers = await _login(client, "emp1@acme.com")

    wrong = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": "wrong", "new_password": "NewPassword123!"},
    )
    assert wrong.status_code == 400, wrong.text

    ok = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": DEFAULT_PASSWORD, "new_password": "NewPassword123!"},
    )
    assert ok.status_code == 200, ok.text

    relogin = await client.post(
        "/api/auth/login",
        data={"username": "emp1@acme.com", "password": "NewPassword123!"},
    )
    assert relogin.status_code == 200, relogin.text


async def test_duplicate_email_returns_conflict(client):
    admin = await _login(client, "admin@acme.com")
    response = await client.post(
        "/api/admin/users",
        headers=admin,
        json={
            "email": "supervisor@acme.com",
            "full_name": "Duplicate",
            "password": DEFAULT_PASSWORD,
            "role": "supervisor",
        },
    )
    assert response.status_code == 409, response.text


async def test_supervisor_can_list_pending_interventions(client):
    supervisor = await _login(client, "supervisor@acme.com")
    response = await client.get("/api/interventions/pending", headers=supervisor)
    assert response.status_code == 200, response.text
    assert response.json() == []
