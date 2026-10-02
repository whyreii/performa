"""Wave 3 backend correctness tests (C3, C4, C12, C9)."""
from __future__ import annotations

from backend.auth import verify_password
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


async def test_rollup_month_filter_and_idempotency(client):
    employer = await _login(client, "employer@acme.com")
    carlos_id = await _find_employee(client, employer, "Carlos Early")

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

    first = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=1", headers=employer
    )
    assert first.status_code == 201, first.text

    pending_first = (await client.get("/api/interventions/pending", headers=employer)).json()
    assert len(pending_first) == 6  # 3 flagged competencies x 2 courses

    # Re-running must regenerate, not duplicate.
    second = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=1", headers=employer
    )
    assert second.status_code == 201, second.text
    pending_second = (await client.get("/api/interventions/pending", headers=employer)).json()
    assert len(pending_second) == 6, "rollup is not idempotent"

    # A month with no evaluations in its window is rejected.
    missing = await client.post(
        f"/api/interventions/{carlos_id}/monthly-rollup?month_number=4", headers=employer
    )
    assert missing.status_code == 404, missing.text


async def test_tenant_audit_trail_pagination(client):
    employer = await _login(client, "employer@acme.com")
    carlos_id = await _find_employee(client, employer, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=employer,
        json={competency: 4.0 for competency in COMPETENCIES},
    )

    limited = await client.get(
        "/api/evaluations/audit-trail?skip=0&limit=1", headers=employer
    )
    assert limited.status_code == 200, limited.text
    assert len(limited.json()) == 1


def test_verify_password_handles_malformed_hash():
    assert verify_password("anything", "not-a-valid-hash") is False
    assert verify_password("anything", "") is False
