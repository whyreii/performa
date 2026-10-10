"""Guardrail: score updates write immutable audit records; no mutation route exists.

The DB-level immutability guarantee (item 6b-3) is installed by
``backend/audit_immutability.py`` on ``create_all`` and by Alembic revision
``0003_immutable_audit`` for existing databases.
"""
from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from backend.audit_immutability import drop_statements_for, statements_for
from backend.main import app
from backend.database import async_session_maker
from backend.ml.catalog import COMPETENCIES
from backend.tests.helpers import (
    DEFAULT_PASSWORD,
    EMPLOYER_EMAIL,
    find_employee_id,
    login_user,
)
from backend.timeutils import manila_today


async def _create_employee(client, employer_headers: dict[str, str], name: str, email: str) -> str:
    """Onboard a fresh probationary employee and return their profile id."""
    supervisors = (
        await client.get("/api/employees/supervisors", headers=employer_headers)
    ).json()
    assert supervisors, "seed must provide at least one supervisor"
    payload = {
        "email": email,
        "full_name": name,
        "password": DEFAULT_PASSWORD,
        "supervisor_id": supervisors[0]["id"],
        "job_title": "Analyst",
        "department": "Operations",
        "start_date": (manila_today() - timedelta(days=10)).isoformat(),
    }
    response = await client.post("/api/employees/", headers=employer_headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_no_audit_trail_mutation_route():
    for route in app.routes:
        methods = getattr(route, "methods", None) or set()
        if "audit-trail" in getattr(route, "path", ""):
            assert methods <= {"GET", "HEAD"}, f"audit route {route.path} allows {methods}"


@pytest.mark.asyncio
async def test_score_update_writes_one_audit_row_per_changed_competency(client):
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")

    before = (await client.get(f"/api/evaluations/{emp_id}/audit-trail", headers=employer)).json()
    created = await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={c: 3.0 for c in COMPETENCIES},
    )
    assert created.status_code == 201, created.text
    after = (await client.get(f"/api/evaluations/{emp_id}/audit-trail", headers=employer)).json()

    assert len(after) - len(before) == 5, "one audit row per changed competency"
    for row in after[:5]:
        assert row["evaluator_name"] and row["evaluator_name"] != "Unknown"
        assert row["competency"] in COMPETENCIES
        assert row["new_score"] == 3.0
        assert row["created_at"]


@pytest.mark.asyncio
async def test_first_entry_prior_score_is_nullable(client):
    """6b-1: an audit row stores the competency; prior_score is null on a first entry."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await _create_employee(client, employer, "Fiona First", "fiona.first@acme.com")

    created = await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={c: 3.0 for c in COMPETENCIES},
    )
    assert created.status_code == 201, created.text

    rows = (
        await client.get(f"/api/evaluations/{emp_id}/audit-trail", headers=employer)
    ).json()
    assert len(rows) == 5
    for row in rows:
        assert row["prior_score"] is None
        assert row["competency"] in COMPETENCIES


@pytest.mark.asyncio
async def test_audit_write_is_atomic_with_score_update(client):
    """6b-2: the score update and its audit rows commit together (neither on failure)."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await _create_employee(client, employer, "Oscar Atomic", "oscar.atomic@acme.com")

    # A rejected submission (future date) must persist neither evaluation nor audit rows.
    future = (manila_today() + timedelta(days=5)).isoformat()
    payload = {c: 3.0 for c in COMPETENCIES}
    payload["evaluation_date"] = future
    rejected = await client.post(
        f"/api/evaluations/{emp_id}/weekly", headers=employer, json=payload
    )
    assert rejected.status_code == 400, rejected.text
    assert (
        await client.get(f"/api/evaluations/{emp_id}/audit-trail", headers=employer)
    ).json() == []

    # An accepted submission commits the evaluation and its five audit rows together.
    accepted = await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={c: 3.0 for c in COMPETENCIES},
    )
    assert accepted.status_code == 201, accepted.text
    assert len(
        (
            await client.get(f"/api/evaluations/{emp_id}/audit-trail", headers=employer)
        ).json()
    ) == 5


@pytest.mark.asyncio
async def test_audit_rows_are_immutable_at_the_database_level(client):
    """6b-3: the database rejects UPDATE and DELETE against the audit trail."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await _create_employee(
        client, employer, "Ivan Immutable", "ivan.immutable@acme.com"
    )
    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={c: 3.0 for c in COMPETENCIES},
    )

    async with async_session_maker() as session:
        with pytest.raises(DBAPIError):
            await session.execute(text("UPDATE evaluation_audit_logs SET new_score = 1.0"))
            await session.commit()
        await session.rollback()

    async with async_session_maker() as session:
        with pytest.raises(DBAPIError):
            await session.execute(text("DELETE FROM evaluation_audit_logs"))
            await session.commit()
        await session.rollback()


@pytest.mark.asyncio
async def test_audit_hash_chain_verifies_after_writes(client):
    """Each append is chained; the verifier reports a valid per-employee chain."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await _create_employee(client, employer, "Grace Chain", "grace.chain@acme.com")

    for score in (3.0, 3.5, 4.0):
        created = await client.post(
            f"/api/evaluations/{emp_id}/weekly",
            headers=employer,
            json={c: score for c in COMPETENCIES},
        )
        assert created.status_code == 201, created.text

    verification = await client.get(
        f"/api/evaluations/{emp_id}/audit-trail/verify", headers=employer
    )
    assert verification.status_code == 200, verification.text
    body = verification.json()
    assert body["valid"] is True
    assert body["checked"] == 15
    assert body["first_broken_id"] is None


@pytest.mark.asyncio
async def test_audit_hash_chain_detects_tampering(client):
    """A row mutated out-of-band breaks the recomputed chain."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await _create_employee(client, employer, "Tara Tamper", "tara.tamper@acme.com")
    created = await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={c: 3.0 for c in COMPETENCIES},
    )
    assert created.status_code == 201, created.text

    # Lift the immutability trigger to simulate an out-of-band edit, then restore
    # it so the shared test database keeps its guarantee.
    async with async_session_maker() as session:
        dialect = session.get_bind().dialect.name
        for statement in drop_statements_for(dialect):
            await session.execute(text(statement))
        await session.execute(text("UPDATE evaluation_audit_logs SET new_score = 1.0"))
        for statement in statements_for(dialect):
            await session.execute(text(statement))
        await session.commit()

    verification = await client.get(
        f"/api/evaluations/{emp_id}/audit-trail/verify", headers=employer
    )
    assert verification.status_code == 200, verification.text
    assert verification.json()["valid"] is False

