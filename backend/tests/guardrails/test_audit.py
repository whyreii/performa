"""Guardrail: score updates write immutable audit records; no mutation route exists."""
from __future__ import annotations

import pytest

from backend.main import app
from backend.ml.catalog import COMPETENCIES
from backend.tests.helpers import EMPLOYER_EMAIL, find_employee_id, login_user


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


@pytest.mark.skip(
    reason="pending decision: 6b-1 (audit record stores competency + period; "
    "prior score is nullable for a first entry)"
)
def test_first_entry_prior_score_is_nullable():
    raise NotImplementedError


@pytest.mark.skip(
    reason="pending decision: 6b-2 (audit row is written in the same DB transaction "
    "as the score update — both commit or neither)"
)
def test_audit_write_is_atomic_with_score_update():
    raise NotImplementedError


@pytest.mark.skip(
    reason="pending decision: 6b-3 (DB-level block on audit-row update/delete, "
    "e.g. a PostgreSQL trigger or restricted permissions)"
)
def test_audit_rows_are_immutable_at_the_database_level():
    raise NotImplementedError
