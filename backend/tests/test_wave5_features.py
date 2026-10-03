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
