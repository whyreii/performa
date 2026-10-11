"""Manuscript-aligned RBAC tests.

Per the amended Scope of the Study, the Administrator has **no access** to
probationary-employee performance data (records, scorecards, evaluations,
interventions, and the Evidentiary Labor Score Audit Trail); those are
Employer/Supervisor/Employee only. Write actions — employee onboarding,
probationary status changes, and KPI configuration — are exclusive to the
Employer (ratings are also permitted to the Supervisor for assigned reports).
The Admin retains system/IT oversight: `/admin/*`, `/settings`, `/notifications`.
The KPI rubric library is Employer/Supervisor only.
"""
from __future__ import annotations

import pytest

from backend.tests.helpers import (
    ADMIN_EMAIL,
    DEFAULT_PASSWORD,
    EMP1_EMAIL,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    find_employee_by_email,
    login_user,
)

_NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000"


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
async def test_admin_cannot_access_kpi_rubrics(client):
    """Admin has no KPI rubric library access (Employer/Supervisor only)."""
    admin = await login_user(client, ADMIN_EMAIL)

    view = await client.get("/api/kpi-rubrics", headers=admin)
    assert view.status_code == 403, view.text

    upsert = await client.put(
        "/api/kpi-rubrics/task_completion",
        headers=admin,
        json={"target_score": 4.5, "weight": 0.25},
    )
    assert upsert.status_code == 403, upsert.text

    reset = await client.post("/api/kpi-rubrics/reset", headers=admin)
    assert reset.status_code == 403, reset.text


@pytest.mark.asyncio
async def test_admin_has_no_employee_data_access(client):
    """Admin is denied employee performance data; system/IT oversight is retained."""
    admin = await login_user(client, ADMIN_EMAIL)

    assert (await client.get("/api/employees/", headers=admin)).status_code == 403
    assert (
        await client.get("/api/employees/supervisors", headers=admin)
    ).status_code == 403
    assert (
        await client.get("/api/interventions/summaries", headers=admin)
    ).status_code == 403
    assert (
        await client.get("/api/evaluations/audit-trail", headers=admin)
    ).status_code == 403

    # System/IT oversight (KPI overview) is retained; the rubric library is not.
    assert (
        await client.get("/api/admin/reports/overview", headers=admin)
    ).status_code == 200
    assert (await client.get("/api/kpi-rubrics", headers=admin)).status_code == 403


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


@pytest.mark.asyncio
async def test_only_employer_can_generate_rollups(client):
    """Rollup generation is Employer-only (Admin/Supervisor are view-only)."""
    admin = await login_user(client, ADMIN_EMAIL)
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)
    url = f"/api/interventions/{_NONEXISTENT_ID}/monthly-rollup?month_number=1"

    assert (await client.post(url, headers=admin)).status_code == 403
    assert (await client.post(url, headers=supervisor)).status_code == 403
    # Employer passes authz; 404 because the employee does not exist.
    assert (await client.post(url, headers=employer)).status_code == 404


@pytest.mark.asyncio
async def test_only_employer_can_dispatch_or_sign_off(client):
    """Summary dispatch and intervention sign-off are Employer-exclusive."""
    admin = await login_user(client, ADMIN_EMAIL)

    dispatch = await client.post(
        f"/api/interventions/summaries/{_NONEXISTENT_ID}/dispatch", headers=admin
    )
    assert dispatch.status_code == 403, dispatch.text

    sign_off = await client.post(
        f"/api/interventions/{_NONEXISTENT_ID}/sign-off",
        headers=admin,
        json={"approved": True},
    )
    assert sign_off.status_code == 403, sign_off.text


@pytest.mark.asyncio
async def test_only_employer_can_generate_regularization(client):
    """Regularization recommendations are Employer-only (Supervisor is view-only)."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    admin = await login_user(client, ADMIN_EMAIL)
    url = f"/api/evaluations/{_NONEXISTENT_ID}/regularization-recommendation"

    assert (await client.post(url, headers=supervisor)).status_code == 403
    assert (await client.post(url, headers=admin)).status_code == 403
