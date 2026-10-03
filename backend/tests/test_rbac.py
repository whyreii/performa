"""Manuscript-aligned RBAC write-lock tests.

Per the Scope of the Study, the Administrator has **view-only** oversight of
employee records, KPIs, and reports. Write actions — employee onboarding,
probationary status changes, and KPI configuration — are exclusive to the
Employer (ratings are also permitted to the Supervisor for assigned reports).
"""
from __future__ import annotations

import pytest

from backend.tests.helpers import (
    ADMIN_EMAIL,
    DEFAULT_PASSWORD,
    EMP1_EMAIL,
    EMPLOYER_EMAIL,
    find_employee_by_email,
    login_user,
)


@pytest.mark.asyncio
async def test_admin_cannot_write_employee_records(client):
    """Admin is denied onboarding and status changes (Employer-only writes)."""
    admin = await login_user(client, ADMIN_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)

    supervisors = await client.get("/api/employees/supervisors", headers=employer)
    assert supervisors.status_code == 200, supervisors.text
    supervisor_id = supervisors.json()[0]["id"]

    create = await client.post(
        "/api/employees/",
        headers=admin,
        json={
            "email": "rbac-admin-created@acme.com",
            "full_name": "Admin Created",
            "department": "Engineering",
            "job_title": "Dev",
            "start_date": "2026-09-01",
            "supervisor_id": supervisor_id,
            "password": DEFAULT_PASSWORD,
        },
    )
    assert create.status_code == 403, create.text

    emp_id = await find_employee_by_email(client, employer, EMP1_EMAIL)
    status = await client.patch(
        f"/api/employees/{emp_id}/status",
        headers=admin,
        json={"status": "regularized"},
    )
    assert status.status_code == 403, status.text


@pytest.mark.asyncio
async def test_admin_cannot_edit_kpi_rubrics(client):
    """Admin may view KPIs but not create/edit them (Employer-exclusive)."""
    admin = await login_user(client, ADMIN_EMAIL)

    view = await client.get("/api/kpi-rubrics", headers=admin)
    assert view.status_code == 200, view.text

    upsert = await client.put(
        "/api/kpi-rubrics/task_completion",
        headers=admin,
        json={"target_score": 4.5, "weight": 0.25},
    )
    assert upsert.status_code == 403, upsert.text

    reset = await client.post("/api/kpi-rubrics/reset", headers=admin)
    assert reset.status_code == 403, reset.text


@pytest.mark.asyncio
async def test_admin_retains_view_only_oversight(client):
    """Admin retains view-only access to employee records and reports."""
    admin = await login_user(client, ADMIN_EMAIL)

    listing = await client.get("/api/employees/", headers=admin)
    assert listing.status_code == 200, listing.text

    emp_id = await find_employee_by_email(client, admin, EMP1_EMAIL)
    detail = await client.get(f"/api/employees/{emp_id}", headers=admin)
    assert detail.status_code == 200, detail.text

    reports = await client.get("/api/admin/reports/overview", headers=admin)
    assert reports.status_code == 200, reports.text


@pytest.mark.asyncio
async def test_employer_retains_write_access(client):
    """Employer retains KPI configuration write access."""
    employer = await login_user(client, EMPLOYER_EMAIL)

    upsert = await client.put(
        "/api/kpi-rubrics/task_completion",
        headers=employer,
        json={"target_score": 4.0, "weight": 0.25},
    )
    assert upsert.status_code == 200, upsert.text

    reset = await client.post("/api/kpi-rubrics/reset", headers=employer)
    assert reset.status_code == 200, reset.text
