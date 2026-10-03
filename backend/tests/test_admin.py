"""System Administrator, user management, and tenant oversight tests."""
from __future__ import annotations

import pytest

from backend.tests.helpers import (
    ADMIN_EMAIL,
    DEFAULT_PASSWORD,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    login_user,
)


@pytest.mark.asyncio
async def test_supervisors_endpoint(client):
    """The supervisors endpoint returns only active supervisors for the tenant."""
    admin = await login_user(client, ADMIN_EMAIL)
    response = await client.get("/api/employees/supervisors", headers=admin)
    assert response.status_code == 200, response.text
    supervisors = response.json()
    assert len(supervisors) >= 1
    assert all(s["role"] == "supervisor" for s in supervisors)
    assert any(s["email"] == SUPERVISOR_EMAIL for s in supervisors)


@pytest.mark.asyncio
async def test_duplicate_email_returns_conflict(client):
    """Onboarding an employee or user with an already-registered email returns 409 Conflict."""
    admin = await login_user(client, ADMIN_EMAIL)
    admin_resp = await client.post(
        "/api/admin/users",
        headers=admin,
        json={
            "email": "supervisor@acme.com",
            "full_name": "Duplicate User",
            "password": DEFAULT_PASSWORD,
            "role": "supervisor",
        },
    )
    assert admin_resp.status_code == 409, admin_resp.text
    assert "already exists" in admin_resp.json()["detail"].lower()

    employer = await login_user(client, EMPLOYER_EMAIL)
    sup_resp = await client.get("/api/employees/supervisors", headers=employer)
    supervisor_id = sup_resp.json()[0]["id"]

    emp_resp = await client.post(
        "/api/employees/",
        headers=employer,
        json={
            "email": "emp1@acme.com",  # already seeded
            "full_name": "Conflict Employee",
            "department": "Engineering",
            "job_title": "Dev",
            "start_date": "2026-09-01",
            "supervisor_id": supervisor_id,
            "password": DEFAULT_PASSWORD,
        },
    )
    assert emp_resp.status_code == 409, emp_resp.text
    assert "already exists" in emp_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_activity_log_records_and_is_admin_only(client):
    """System activity log records operational events and is restricted to administrators."""
    admin = await login_user(client, ADMIN_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)

    forbidden = await client.get("/api/admin/activity", headers=employer)
    assert forbidden.status_code == 403

    allowed = await client.get("/api/admin/activity", headers=admin)
    assert allowed.status_code == 200, allowed.text
    logs = allowed.json()
    assert isinstance(logs, list)
    assert any(entry["action"] == "auth.login" for entry in logs)


@pytest.mark.asyncio
async def test_admin_settings_and_reports(client):
    """Admin settings endpoint returns statutory deadline thresholds and KPI templates."""
    admin = await login_user(client, ADMIN_EMAIL)
    settings = await client.get("/api/admin/settings", headers=admin)
    assert settings.status_code == 200, settings.text
    data = settings.json()
    assert "deadline_thresholds" in data
    assert data["deadline_thresholds"]["day_150"] == 150
    assert "kpi_templates" in data
