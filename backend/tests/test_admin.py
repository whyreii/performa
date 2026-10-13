"""System Administrator, user management, and tenant oversight tests."""
from __future__ import annotations

import logging

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
    """The supervisors endpoint returns only active supervisors for the tenant (Employer)."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    response = await client.get("/api/employees/supervisors", headers=employer)
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
    assert any(entry.get("organization_name") == "Acme Philippines Corp." for entry in logs)


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


@pytest.mark.asyncio
async def test_admin_provisions_new_tenant_for_employer(client):
    """Creating an employer with a new organization name provisions an empty tenant."""
    admin = await login_user(client, ADMIN_EMAIL)
    created = await client.post(
        "/api/admin/users",
        headers=admin,
        json={
            "email": "owner@newco.ph",
            "full_name": "New Owner",
            "password": DEFAULT_PASSWORD,
            "role": "employer",
            "organization_name": "NewCo Philippines",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["organization_id"] != "acme-ph"

    owner = await login_user(client, "owner@newco.ph")
    listing = await client.get("/api/employees/", headers=owner)
    assert listing.status_code == 200, listing.text
    assert listing.json() == [], "a provisioned tenant must start empty"

    me = await client.get("/api/auth/me", headers=owner)
    assert me.json()["organization_name"] == "NewCo Philippines"

    # The platform administrator can see the provisioned account.
    users = await client.get("/api/admin/users", headers=admin)
    assert any(u["email"] == "owner@newco.ph" for u in users.json())


@pytest.mark.asyncio
async def test_admin_reuses_existing_tenant_by_name(client):
    """Naming an existing organization assigns the account to that tenant."""
    admin = await login_user(client, ADMIN_EMAIL)
    created = await client.post(
        "/api/admin/users",
        headers=admin,
        json={
            "email": "second.supervisor@acme.com",
            "full_name": "Second Supervisor",
            "password": DEFAULT_PASSWORD,
            "role": "supervisor",
            "organization_name": "Acme Philippines Corp.",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["organization_id"] == "acme-ph"


@pytest.mark.asyncio
async def test_admin_create_without_password_generates_and_emails(client, caplog):
    """Omitting the password generates one and emails it (logged without SMTP)."""
    admin = await login_user(client, ADMIN_EMAIL)
    with caplog.at_level(logging.WARNING):
        created = await client.post(
            "/api/admin/users",
            headers=admin,
            json={
                "email": "auto.credentials@acme.com",
                "full_name": "Auto Credentials",
                "role": "supervisor",
            },
        )
    assert created.status_code == 201, created.text
    assert "password" not in created.json()

    # The generated credential is delivered by email (logged in the no-SMTP fallback).
    assert "auto.credentials@acme.com" in caplog.text

    # The old shared default must NOT authenticate on the new account.
    guess = await client.post(
        "/api/auth/login",
        data={"username": "auto.credentials@acme.com", "password": DEFAULT_PASSWORD},
    )
    assert guess.status_code == 401


@pytest.mark.asyncio
async def test_admin_can_list_organizations(client):
    """The organization list is Admin-only and returns tenant name + slug."""
    admin = await login_user(client, ADMIN_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)

    forbidden = await client.get("/api/admin/organizations", headers=employer)
    assert forbidden.status_code == 403

    allowed = await client.get("/api/admin/organizations", headers=admin)
    assert allowed.status_code == 200, allowed.text
    slugs = {org["slug"] for org in allowed.json()}
    assert "acme-ph" in slugs
