"""Philippine Labor Code Article 296 statutory milestone and onboarding tests."""
from __future__ import annotations

import os
from datetime import date, timedelta

import pytest

from backend.timeutils import manila_today
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


# ---------------------------------------------------------------------------
# Clock override (PERFORMA_TODAY) + statutory boundary shifts
# ---------------------------------------------------------------------------
BOUNDARY_START = date(2026, 1, 1)


def test_manila_today_honors_performa_today_override(monkeypatch):
    """PERFORMA_TODAY pins manila_today(); removing it restores real-time."""
    monkeypatch.setenv("PERFORMA_TODAY", "2026-06-15")
    assert manila_today() == date(2026, 6, 15)

    monkeypatch.delenv("PERFORMA_TODAY", raising=False)
    assert abs((manila_today() - date.today()).days) <= 1


def test_manila_today_invalid_override_falls_back(monkeypatch):
    """A malformed PERFORMA_TODAY is ignored in favour of the real Manila date."""
    monkeypatch.setenv("PERFORMA_TODAY", "not-a-date")
    assert abs((manila_today() - date.today()).days) <= 1


def test_override_cleanup_is_enforced_by_autouse_fixture():
    """Directly set the env var (no monkeypatch) — the autouse fixture must clear it."""
    os.environ["PERFORMA_TODAY"] = "2030-01-01"
    assert manila_today() == date(2030, 1, 1)


def test_override_does_not_leak_into_next_test():
    """Proves the previous test's PERFORMA_TODAY did not pollute this one."""
    assert "PERFORMA_TODAY" not in os.environ


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("day", "expect_150", "expect_165", "expect_178"),
    [
        (149, False, False, False),
        (150, True, False, False),
        (164, True, False, False),
        (165, True, True, False),
        (177, True, True, False),
        (178, True, True, True),
    ],
)
async def test_milestone_boundaries_shift_with_clock_override(
    client, monkeypatch, day, expect_150, expect_165, expect_178
):
    """Reached-flags flip exactly at Day 150 / 165 / 178 as the clock advances."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    supervisors = (
        await client.get("/api/employees/supervisors", headers=employer)
    ).json()
    supervisor_id = supervisors[0]["id"]

    create = await client.post(
        "/api/employees/",
        headers=employer,
        json={
            "email": f"boundary.day{day}@acme.com",
            "full_name": f"Boundary Day {day}",
            "department": "Quality",
            "job_title": "Analyst",
            "start_date": BOUNDARY_START.isoformat(),
            "supervisor_id": supervisor_id,
            "password": "Password123!",
        },
    )
    assert create.status_code == 201, create.text
    employee_id = create.json()["id"]

    as_of = BOUNDARY_START + timedelta(days=day)
    monkeypatch.setenv("PERFORMA_TODAY", as_of.isoformat())

    report = (await client.get("/api/employees/milestones", headers=employer)).json()
    assert report["as_of"] == as_of.isoformat()

    entry = next(
        (
            item
            for bucket in ("day_150", "day_165", "day_178")
            for item in report[bucket]
            if item["employee"]["id"] == employee_id
        ),
        None,
    )
    assert entry is not None, "employee should appear in the milestone report"

    assert entry["days_elapsed"] == day
    assert entry["days_remaining"] == 180 - day
    assert entry["day_150_reached"] == expect_150
    assert entry["day_165_reached"] == expect_165
    assert entry["day_178_reached"] == expect_178
