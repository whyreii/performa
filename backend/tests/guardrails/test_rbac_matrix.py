"""Guardrail: server-side RBAC matrix across every route x role (AGENTS.md §2).

The expected-permission matrix is declared here as DATA, transcribed from
AGENTS.md §2 (not inferred from the code). A discovered route missing from the
matrix FAILS the test, so new routes must be classified.
"""
from __future__ import annotations

import pytest

from backend.main import app
from backend.ml.catalog import COMPETENCIES
from backend.tests.helpers import (
    ADMIN_EMAIL,
    EMP1_EMAIL,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    find_employee_id,
    login_user,
)

FAKE_ID = "00000000-0000-0000-0000-000000000000"
SKIP_PREFIXES = ("/openapi", "/docs", "/redoc")
ACKNOWLEDGE_PATH = "/api/employees/{employee_id}/acknowledge-standards"

ALL = {"admin", "employer", "supervisor", "probationary_employee"}

# Roles that may read probationary-employee performance data. The Admin is
# excluded (amended manuscript scope): see AGENTS.md §2 / ARCHITECTURE.md §6a-3.
PERFORMANCE_READERS = {"employer", "supervisor", "probationary_employee"}

PUBLIC = {
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/logout"),
    ("GET", "/"),
    ("GET", "/health"),
}

# (method, path) -> allowed roles. Missing => must be added (test fails).
MATRIX = {
    ("GET", "/api/auth/me"): ALL,
    ("PATCH", "/api/auth/me"): ALL,
    ("POST", "/api/auth/change-password"): ALL,
    ("PATCH", "/api/organization"): {"admin", "employer"},
    ("GET", "/api/admin/users"): {"admin"},
    ("GET", "/api/admin/organizations"): {"admin"},
    ("POST", "/api/admin/users"): {"admin"},
    ("PATCH", "/api/admin/users/{user_id}/status"): {"admin"},
    ("POST", "/api/admin/users/{user_id}/reset-password"): {"admin"},
    ("GET", "/api/admin/activity"): {"admin"},
    ("GET", "/api/admin/settings"): {"admin"},
    ("GET", "/api/admin/reports/overview"): {"admin"},
    ("POST", "/api/employees/"): {"employer"},
    ("GET", "/api/employees/"): PERFORMANCE_READERS,
    ("GET", "/api/employees/milestones"): {"employer", "supervisor"},
    ("POST", "/api/employees/milestones/scan"): {"employer"},
    ("GET", "/api/employees/supervisors"): {"employer"},
    ("GET", "/api/employees/{employee_id}"): PERFORMANCE_READERS,
    ("POST", "/api/employees/{employee_id}/acknowledge-standards"): {"probationary_employee"},
    ("PATCH", "/api/employees/{employee_id}/status"): {"employer"},
    ("POST", "/api/evaluations/{employee_id}/weekly"): {"employer", "supervisor"},
    ("GET", "/api/evaluations/{employee_id}/scorecard"): PERFORMANCE_READERS,
    ("GET", "/api/evaluations/{employee_id}/risk-explanation"): PERFORMANCE_READERS,
    ("GET", "/api/evaluations/{employee_id}/trend"): PERFORMANCE_READERS,
    ("POST", "/api/evaluations/{employee_id}/regularization-recommendation"): {"employer"},
    ("GET", "/api/evaluations/{employee_id}/regularization-recommendation"): PERFORMANCE_READERS,
    ("GET", "/api/evaluations/{employee_id}/report"): PERFORMANCE_READERS,
    ("GET", "/api/evaluations/audit-trail"): {"employer"},
    ("GET", "/api/evaluations/{employee_id}/audit-trail"): PERFORMANCE_READERS,
    ("GET", "/api/evaluations/{employee_id}/audit-trail/verify"): PERFORMANCE_READERS,
    ("POST", "/api/interventions/{employee_id}/monthly-rollup"): {"employer"},
    ("GET", "/api/interventions/mine"): ALL,
    ("GET", "/api/interventions/summaries"): {"employer"},
    ("GET", "/api/interventions/summaries/mine"): ALL,
    ("POST", "/api/interventions/summaries/{summary_id}/dispatch"): {"employer"},
    ("POST", "/api/interventions/summaries/{summary_id}/acknowledge"): ALL,
    ("GET", "/api/interventions/pending"): {"employer", "supervisor"},
    ("POST", "/api/interventions/{plan_id}/sign-off"): {"employer"},
    ("GET", "/api/kpi-rubrics"): {"admin", "employer", "supervisor"},
    ("GET", "/api/kpi-rubrics/templates"): ALL,
    ("PUT", "/api/kpi-rubrics/{competency}"): {"employer"},
    ("POST", "/api/kpi-rubrics/reset"): {"employer"},
    ("GET", "/api/notifications"): ALL,
    ("POST", "/api/notifications/{notification_id}/read"): ALL,
    ("POST", "/api/notifications/read-all"): ALL,
}


def _routes():
    for route in app.routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", "")
        if not methods or path.startswith(SKIP_PREFIXES):
            continue
        for method in methods:
            if method in ("HEAD", "OPTIONS"):
                continue
            yield method, path


def _url(path: str, real_emp_id: str) -> str:
    # The ownership-scoped route fetches the row before checking the role, so a
    # fake id yields 404 (not 403) for non-owners; give it a real employee id.
    employee_id = real_emp_id if path == ACKNOWLEDGE_PATH else FAKE_ID
    for token, value in {
        "{user_id}": FAKE_ID,
        "{employee_id}": employee_id,
        "{summary_id}": FAKE_ID,
        "{plan_id}": FAKE_ID,
        "{notification_id}": FAKE_ID,
        "{competency}": "task_completion",
    }.items():
        path = path.replace(token, value)
    return path


def test_every_route_is_classified():
    unclassified = [
        (m, p) for (m, p) in _routes() if (m, p) not in MATRIX and (m, p) not in PUBLIC
    ]
    assert not unclassified, f"Unclassified routes (add to MATRIX): {unclassified}"


@pytest.mark.asyncio
async def test_rbac_matrix(client):
    headers_by_role = {
        "admin": await login_user(client, ADMIN_EMAIL),
        "employer": await login_user(client, EMPLOYER_EMAIL),
        "supervisor": await login_user(client, SUPERVISOR_EMAIL),
        "probationary_employee": await login_user(client, EMP1_EMAIL),
    }

    # The shared client keeps a cookie jar from login; clear it so the
    # unauthenticated probe is genuinely unauthenticated (role probes below
    # pass explicit Bearer headers, so cookies are not needed).
    client.cookies.clear()

    real_emp_id = await find_employee_id(client, headers_by_role["employer"], "Carlos Early")

    problems = []
    for method, path in _routes():
        url = _url(path, real_emp_id)
        is_public = (method, path) in PUBLIC
        allowed = MATRIX.get((method, path), set())

        unauth = await client.request(method, url)
        if is_public:
            if unauth.status_code == 401:
                problems.append(f"{method} {path} [unauth]: expected public, got 401")
            continue
        if unauth.status_code != 401:
            problems.append(f"{method} {path} [unauth]: expected 401, got {unauth.status_code}")

        for role, headers in headers_by_role.items():
            resp = await client.request(method, url, headers=headers)
            if role in allowed:
                if resp.status_code == 403:
                    problems.append(f"{method} {path} [{role}]: expected allowed, got 403")
            elif resp.status_code != 403:
                problems.append(f"{method} {path} [{role}]: expected 403, got {resp.status_code}")

    assert not problems, "RBAC matrix violations:\n" + "\n".join(problems)


@pytest.mark.asyncio
async def test_supervisor_only_reaches_assigned_direct_reports(client):
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)
    me = (await client.get("/api/auth/me", headers=supervisor)).json()

    assigned = (await client.get("/api/employees/", headers=supervisor)).json()
    assert assigned, "supervisor should have at least one assigned report"
    assert all(e["supervisor_id"] == me["id"] for e in assigned)

    all_employees = (await client.get("/api/employees/", headers=employer)).json()
    unassigned = [e for e in all_employees if e["supervisor_id"] != me["id"]]
    assert unassigned, "seed should include an employee with no supervisor"

    denied = await client.post(
        f"/api/evaluations/{unassigned[0]['id']}/weekly",
        headers=supervisor,
        json={c: 4.0 for c in COMPETENCIES},
    )
    assert denied.status_code == 403, denied.text


@pytest.mark.asyncio
async def test_employee_only_reaches_self(client):
    emp1 = await login_user(client, EMP1_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)

    listing = (await client.get("/api/employees/", headers=emp1)).json()
    assert {e["user"]["email"] for e in listing} == {EMP1_EMAIL}

    own_id = listing[0]["id"]
    assert (await client.get(f"/api/employees/{own_id}", headers=emp1)).status_code == 200

    other_id = await find_employee_id(client, employer, "Maria Midterm")
    denied = await client.get(f"/api/employees/{other_id}", headers=emp1)
    assert denied.status_code == 403, denied.text


@pytest.mark.asyncio
async def test_cross_tenant_access_is_denied(client):
    from backend.auth import get_password_hash
    from backend.database import async_session_maker
    from backend.models import Organization, User, UserRole

    async with async_session_maker() as session:
        session.add(Organization(name="Other Corp.", slug="other-ph"))
        session.add(
            User(
                email="employer@other.com",
                hashed_password=get_password_hash("Password123!"),
                full_name="Other Employer",
                role=UserRole.EMPLOYER,
                organization_id="other-ph",
            )
        )
        await session.commit()

    other = await login_user(client, "employer@other.com")
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")

    detail = await client.get(f"/api/employees/{emp_id}", headers=other)
    assert detail.status_code == 404, detail.text

    listing = await client.get("/api/employees/", headers=other)
    assert listing.status_code == 200
    assert listing.json() == [], "second tenant must not see another tenant's employees"
