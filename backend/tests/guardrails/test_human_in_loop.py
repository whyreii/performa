"""Guardrail: only the Employer can move an intervention out of pending_approval."""
from __future__ import annotations

import pytest

from backend.ml.catalog import COMPETENCIES
from backend.tests.helpers import (
    ADMIN_EMAIL,
    EMP1_EMAIL,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    find_employee_id,
    login_user,
)


async def _pending_plans(client, employer, emp_id):
    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={c: 2.0 for c in COMPETENCIES},
    )
    rollup = await client.post(
        f"/api/interventions/{emp_id}/monthly-rollup?month_number=2", headers=employer
    )
    assert rollup.status_code == 201, rollup.text
    return (await client.get("/api/interventions/pending", headers=employer)).json()


@pytest.mark.asyncio
async def test_rollup_creates_only_pending_approval_plans(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    plans = await _pending_plans(client, employer, emp_id)
    assert plans, "a low-score rollup must create interventions"
    assert all(p["status"] == "pending_approval" for p in plans)


@pytest.mark.asyncio
async def test_only_employer_can_sign_off(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")
    plan_id = (await _pending_plans(client, employer, emp_id))[0]["id"]

    for email in (ADMIN_EMAIL, SUPERVISOR_EMAIL, EMP1_EMAIL):
        headers = await login_user(client, email)
        resp = await client.post(
            f"/api/interventions/{plan_id}/sign-off", headers=headers, json={"approved": True}
        )
        assert resp.status_code == 403, f"{email} must not sign off (got {resp.status_code})"

    ok = await client.post(
        f"/api/interventions/{plan_id}/sign-off", headers=employer, json={"approved": True}
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "approved"
