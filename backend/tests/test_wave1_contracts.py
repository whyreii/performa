"""Wave 1 (P0) contract and regression tests.

Covers the gaps fixed in Wave 1: A1 (onboarding), A2 (scorecard shape),
A3 (audit shape), A4 (employee interventions), and C11 (health).
"""
from __future__ import annotations

from datetime import date, timedelta

from backend.ml.catalog import COMPETENCIES

DEFAULT_PASSWORD = "Password123!"


async def _login(client, email: str, password: str = DEFAULT_PASSWORD):
    response = await client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _employee_id(client, headers, full_name: str) -> str:
    response = await client.get("/api/employees/", headers=headers)
    assert response.status_code == 200, response.text
    return next(
        emp["id"] for emp in response.json() if emp["user"]["full_name"] == full_name
    )


async def test_health_reports_database(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


async def test_supervisors_endpoint(client):
    employer = await _login(client, "employer@acme.com")
    response = await client.get("/api/employees/supervisors", headers=employer)
    assert response.status_code == 200, response.text
    supervisors = response.json()
    assert supervisors, "expected at least one seeded supervisor"
    assert all(user["role"] == "supervisor" for user in supervisors)
    assert "supervisor@acme.com" in {user["email"] for user in supervisors}

    supervisor = await _login(client, "supervisor@acme.com")
    forbidden = await client.get("/api/employees/supervisors", headers=supervisor)
    assert forbidden.status_code == 403


async def test_onboard_employee_with_supervisor(client):
    employer = await _login(client, "employer@acme.com")
    supervisors = (await client.get("/api/employees/supervisors", headers=employer)).json()
    supervisor_id = supervisors[0]["id"]

    start_date = date(2026, 5, 1)
    payload = {
        "full_name": "Nina Newhire",
        "email": "nina@acme.com",
        "password": DEFAULT_PASSWORD,
        "department": "Engineering",
        "job_title": "Junior Dev",
        "start_date": start_date.isoformat(),
        "supervisor_id": supervisor_id,
    }
    response = await client.post("/api/employees/", headers=employer, json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["supervisor_id"] == supervisor_id
    assert body["day_180_date"] == (start_date + timedelta(days=180)).isoformat()


async def test_onboard_requires_supervisor(client):
    employer = await _login(client, "employer@acme.com")
    payload = {
        "full_name": "No Supervisor",
        "email": "nosup@acme.com",
        "password": DEFAULT_PASSWORD,
        "department": "Engineering",
        "job_title": "Dev",
        "start_date": "2026-05-01",
    }
    response = await client.post("/api/employees/", headers=employer, json=payload)
    assert response.status_code == 422, response.text


async def test_scorecard_contract(client):
    supervisor = await _login(client, "supervisor@acme.com")
    employee_id = await _employee_id(client, supervisor, "Carlos Early")

    scores = {competency: 4.0 for competency in COMPETENCIES}
    created = await client.post(
        f"/api/evaluations/{employee_id}/weekly", headers=supervisor, json=scores
    )
    assert created.status_code == 201, created.text

    response = await client.get(
        f"/api/evaluations/{employee_id}/scorecard", headers=supervisor
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["key"] for item in body["competencies"]] == list(COMPETENCIES)
    for item in body["competencies"]:
        assert {"key", "label", "score", "target", "gap"} <= set(item)


async def test_audit_trail_contract(client):
    supervisor = await _login(client, "supervisor@acme.com")
    employee_id = await _employee_id(client, supervisor, "Carlos Early")

    await client.post(
        f"/api/evaluations/{employee_id}/weekly",
        headers=supervisor,
        json={competency: 3.5 for competency in COMPETENCIES},
    )
    response = await client.get(
        f"/api/evaluations/{employee_id}/audit-trail", headers=supervisor
    )
    assert response.status_code == 200, response.text
    logs = response.json()
    assert len(logs) == len(COMPETENCIES)
    for entry in logs:
        assert {
            "evaluator_name",
            "competency",
            "prior_score",
            "new_score",
            "created_at",
        } <= set(entry)
        assert entry["prior_score"] is None


async def test_my_interventions_is_self_scoped(client):
    employee = await _login(client, "emp1@acme.com")
    response = await client.get("/api/interventions/mine", headers=employee)
    assert response.status_code == 200, response.text
    assert response.json() == []

    employer = await _login(client, "employer@acme.com")
    no_profile = await client.get("/api/interventions/mine", headers=employer)
    assert no_profile.status_code == 404


async def test_pending_requires_employer_role(client):
    employee = await _login(client, "emp1@acme.com")
    response = await client.get("/api/interventions/pending", headers=employee)
    assert response.status_code == 403
