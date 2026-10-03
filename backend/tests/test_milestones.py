"""Philippine Labor Code Article 296 statutory milestone and onboarding tests."""
from __future__ import annotations

import pytest

from backend.tests.helpers import (
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    find_employee_id,
    login_user,
)


@pytest.mark.asyncio
async def test_onboard_employee_with_supervisor(client):
    """Employer successfully onboards a probationary employee with an assigned supervisor."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    sup_resp = await client.get("/api/employees/supervisors", headers=employer)
    supervisor_id = sup_resp.json()[0]["id"]

    create_resp = await client.post(
        "/api/employees/",
        headers=employer,
        json={
            "email": "newbie.milestone@acme.com",
            "full_name": "Newbie Milestone",
            "department": "Engineering",
            "job_title": "Backend Engineer",
            "start_date": "2026-09-01",
            "supervisor_id": supervisor_id,
            "password": "Password123!",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    body = create_resp.json()
    assert body["user"]["email"] == "newbie.milestone@acme.com"
    assert body["supervisor"]["id"] == supervisor_id
    assert body["status"] == "active"


@pytest.mark.asyncio
async def test_onboard_requires_supervisor(client):
    """Onboarding payload without supervisor_id fails validation with 422 Unprocessable Entity."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    create_resp = await client.post(
        "/api/employees/",
        headers=employer,
        json={
            "email": "orphan@acme.com",
            "full_name": "Orphan Employee",
            "department": "Engineering",
            "job_title": "Backend Engineer",
            "start_date": "2026-09-01",
        },
    )
    assert create_resp.status_code == 422


@pytest.mark.asyncio
async def test_terminate_requires_reason(client):
    """Terminating a probationary employee requires a documented reason for Article 296 compliance."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")

    no_reason = await client.patch(
        f"/api/employees/{emp_id}/status",
        headers=employer,
        json={"status": "terminated"},
    )
    assert no_reason.status_code == 400
    assert "reason is required" in no_reason.json()["detail"]

    with_reason = await client.patch(
        f"/api/employees/{emp_id}/status",
        headers=employer,
        json={
            "status": "terminated",
            "reason": "Failed to meet minimum Article 296 performance standards after Day 150 review.",
        },
    )
    assert with_reason.status_code == 200, with_reason.text
    assert with_reason.json()["status"] == "terminated"


@pytest.mark.asyncio
async def test_milestones_report_statutory_thresholds(client):
    """The milestones endpoint correctly reports employees approaching or past Days 150, 165, and 178."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    response = await client.get("/api/employees/milestones", headers=employer)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "as_of" in data
    assert "day_150" in data
    assert "day_165" in data
    assert "day_178" in data
    assert isinstance(data["day_150"], list)
    assert isinstance(data["day_165"], list)
    assert isinstance(data["day_178"], list)
    assert len(data["day_150"]) >= 1
