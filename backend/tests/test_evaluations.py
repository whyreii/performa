"""Weekly KPI evaluations, scorecard gap calculations, and immutable audit trail tests."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from backend.ml.catalog import COMPETENCIES
from backend.tests.helpers import (
    EMP1_EMAIL,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    find_employee_id,
    login_user,
)


@pytest.mark.asyncio
async def test_scorecard_contract(client):
    """Scorecard returns competencies as an array of structured items with targets and gaps."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")

    scores = {competency: 4.0 for competency in COMPETENCIES}
    created = await client.post(
        f"/api/evaluations/{emp_id}/weekly", headers=supervisor, json=scores
    )
    assert created.status_code == 201, created.text

    response = await client.get(f"/api/evaluations/{emp_id}/scorecard", headers=supervisor)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "competencies" in data
    assert isinstance(data["competencies"], list)
    assert len(data["competencies"]) == 5
    for comp in data["competencies"]:
        assert "key" in comp
        assert "label" in comp
        assert "score" in comp
        assert "target" in comp
        assert "gap" in comp
        assert comp["target"] == 4.0


@pytest.mark.asyncio
async def test_scorecard_404_when_no_evaluations(client):
    """An employee with zero weekly evaluations yields 404 on the scorecard endpoint."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    maria_id = await find_employee_id(client, employer, "Maria Midterm")

    response = await client.get(
        f"/api/evaluations/{maria_id}/scorecard", headers=employer
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_audit_trail_contract(client):
    """Audit trail items contain evaluator_name, competency, prior_score, and new_score."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")

    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=supervisor,
        json={competency: 3.5 for competency in COMPETENCIES},
    )

    response = await client.get(f"/api/evaluations/{emp_id}/audit-trail", headers=supervisor)
    assert response.status_code == 200, response.text
    logs = response.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1
    sample = logs[0]
    assert "evaluator_name" in sample
    assert "competency" in sample
    assert "prior_score" in sample
    assert "new_score" in sample
    assert sample["evaluator_name"] != "Unknown"


@pytest.mark.asyncio
async def test_tenant_audit_trail_pagination(client):
    """Tenant-wide audit trail endpoint supports skip and limit pagination parameters."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, employer, "Carlos Early")

    await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=employer,
        json={competency: 4.0 for competency in COMPETENCIES},
    )

    limited = await client.get(
        "/api/evaluations/audit-trail?skip=0&limit=1", headers=employer
    )
    assert limited.status_code == 200, limited.text
    assert len(limited.json()) == 1


@pytest.mark.asyncio
async def test_supervisor_cannot_rate_unassigned_employee(client):
    """A supervisor cannot rate an employee assigned to someone else (yields 403)."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)
    unassigned_id = await find_employee_id(client, employer, "Pedro Notice")

    response = await client.post(
        f"/api/evaluations/{unassigned_id}/weekly",
        headers=supervisor,
        json={competency: 3.5 for competency in COMPETENCIES},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_kpi_rubrics_defaults_and_update(client):
    """Customizable KPI rubric targets and weights can be updated and reset."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    rubrics = await client.get("/api/kpi-rubrics", headers=employer)
    assert rubrics.status_code == 200, rubrics.text
    items = rubrics.json()
    assert len(items) == 5

    update = await client.put(
        "/api/kpi-rubrics/task_completion",
        headers=employer,
        json={"target_score": 4.5, "weight": 0.25},
    )
    assert update.status_code == 200, update.text
    assert update.json()["target_score"] == 4.5

    reset = await client.post("/api/kpi-rubrics/reset", headers=employer)
    assert reset.status_code == 200, reset.text
    first = reset.json()[0]
    assert first["target_score"] == 4.0


@pytest.mark.asyncio
async def test_kpi_rubrics_bulk_save_is_atomic(client):
    """Bulk save applies every row in one transaction; a zero total is rejected."""
    employer = await login_user(client, EMPLOYER_EMAIL)
    await client.get("/api/kpi-rubrics", headers=employer)  # provision defaults

    # Moving all weight onto one competency is a legal final state and must be
    # accepted as a single write (the per-row path could transiently hit 0).
    moved = [
        {"competency": c, "target_score": 4.0, "weight": 1.0 if c == "quality_of_work" else 0.0}
        for c in COMPETENCIES
    ]
    ok = await client.put("/api/kpi-rubrics", headers=employer, json={"items": moved})
    assert ok.status_code == 200, ok.text
    weights = {r["competency"]: float(r["weight"]) for r in ok.json()}
    assert weights["quality_of_work"] == 1.0
    assert sum(weights.values()) == 1.0

    # A payload that would zero the org is rejected and nothing changes.
    zeroed = [{"competency": c, "target_score": 4.0, "weight": 0.0} for c in COMPETENCIES]
    bad = await client.put("/api/kpi-rubrics", headers=employer, json={"items": zeroed})
    assert bad.status_code == 422, bad.text
    after = await client.get("/api/kpi-rubrics", headers=employer)
    assert {r["competency"]: float(r["weight"]) for r in after.json()} == weights


@pytest.mark.asyncio
async def test_kpi_trend(client):
    """The trend endpoint returns chronological monthly competency averages."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    carlos_id = await find_employee_id(client, supervisor, "Carlos Early")
    await client.post(
        f"/api/evaluations/{carlos_id}/weekly",
        headers=supervisor,
        json={competency: 4.0 for competency in COMPETENCIES},
    )

    response = await client.get(
        f"/api/evaluations/{carlos_id}/trend", headers=supervisor
    )
    assert response.status_code == 200, response.text
    points = response.json()
    assert len(points) >= 1
    assert points[0]["month_number"] == 2
    assert set(COMPETENCIES) <= set(points[0])


@pytest.mark.asyncio
async def test_weekly_rating_rejects_future_date(client):
    """A weekly rating dated in the future is refused (400)."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")

    future = (date.today() + timedelta(days=5)).isoformat()
    payload = {competency: 4.0 for competency in COMPETENCIES}
    payload["evaluation_date"] = future

    response = await client.post(
        f"/api/evaluations/{emp_id}/weekly", headers=supervisor, json=payload
    )
    assert response.status_code == 400, response.text
    assert "future" in response.json()["detail"]


@pytest.mark.asyncio
async def test_weekly_remarks_are_returned(client):
    """Behavioral remarks submitted with a rating are retrievable from the record."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")

    payload = {competency: 4.0 for competency in COMPETENCIES}
    payload["remarks"] = "Strong week; delivered the Q3 reconciliation ahead of schedule."
    created = await client.post(
        f"/api/evaluations/{emp_id}/weekly", headers=supervisor, json=payload
    )
    assert created.status_code == 201, created.text

    response = await client.get(f"/api/evaluations/{emp_id}/weekly", headers=supervisor)
    assert response.status_code == 200, response.text
    rows = response.json()
    assert rows, "expected at least one weekly evaluation"
    assert rows[0]["remarks"] == "Strong week; delivered the Q3 reconciliation ahead of schedule."
    assert rows[0]["evaluator_name"] and rows[0]["evaluator_name"] != "Unknown"


@pytest.mark.asyncio
async def test_seed_hashes_the_audit_chain(client):
    """The seed hashes its audit rows, so verification actually checks them."""
    from sqlalchemy import select

    from backend.database import async_session_maker
    from backend.models import EvaluationAuditLog, ProbationaryEmployee, User
    from backend.routers.evaluations import _verify_audit_chain
    from backend.seed import seed

    # The shared fixture seeds without evaluations; re-seed with them so history exists.
    async with async_session_maker() as session:
        await seed(session, with_evaluations=True)
        carlos = (
            await session.execute(
                select(ProbationaryEmployee)
                .join(User, ProbationaryEmployee.user_id == User.id)
                .where(User.email == EMP1_EMAIL)
            )
        ).scalar_one()
        rows = list(
            (
                await session.execute(
                    select(EvaluationAuditLog)
                    .where(EvaluationAuditLog.employee_id == carlos.id)
                    .order_by(EvaluationAuditLog.created_at.asc(), EvaluationAuditLog.id.asc())
                )
            )
            .scalars()
            .all()
        )

    assert rows, "the seed should create audit rows for a rated employee"
    valid, broken_id, checked = _verify_audit_chain(rows)
    assert valid is True, f"seeded chain is broken at {broken_id}"
    assert checked == len(rows) > 0, "every seeded row must carry a record_hash"


def test_verify_audit_chain_detects_a_tampered_row():
    """A changed score breaks the recomputed chain (unit-level, no DB)."""
    from types import SimpleNamespace

    from backend.audit_chain import audit_record_hash
    from backend.routers.evaluations import _verify_audit_chain

    emp = uuid.uuid4()
    ev = uuid.uuid4()
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    first_hash = audit_record_hash(None, "acme-ph", emp, ev, "task_completion", None, 4.0, t0)
    second_hash = audit_record_hash(
        first_hash, "acme-ph", emp, ev, "quality_of_work", None, 4.0, t0
    )
    rows = [
        SimpleNamespace(
            id=uuid.uuid4(),
            organization_id="acme-ph",
            employee_id=emp,
            evaluator_id=ev,
            competency="task_completion",
            prior_score=None,
            new_score=4.0,
            created_at=t0,
            prev_hash=None,
            record_hash=first_hash,
        ),
        SimpleNamespace(
            id=uuid.uuid4(),
            organization_id="acme-ph",
            employee_id=emp,
            evaluator_id=ev,
            competency="quality_of_work",
            prior_score=None,
            new_score=2.0,  # tampered: the hash was computed with 4.0
            created_at=t0,
            prev_hash=first_hash,
            record_hash=second_hash,
        ),
    ]
    valid, broken_id, checked = _verify_audit_chain(rows)
    assert valid is False
    assert broken_id == rows[1].id
    assert checked == 1


@pytest.mark.asyncio
async def test_kpi_config_changes_are_audited_and_listed(client):
    """A KPI change writes an activity row that the employer can review."""
    employer = await login_user(client, EMPLOYER_EMAIL)

    update = await client.put(
        "/api/kpi-rubrics/task_completion",
        headers=employer,
        json={"target_score": 4.5, "weight": 0.25},
    )
    assert update.status_code == 200, update.text

    history = await client.get("/api/kpi-rubrics/history", headers=employer)
    assert history.status_code == 200, history.text
    rows = history.json()
    assert rows, "a KPI change must be recorded in the configuration history"
    assert rows[0]["action"] in ("kpi.update", "kpi.reset")
    assert rows[0]["actor_name"], "the actor should be named"


@pytest.mark.asyncio
async def test_audit_trail_csv_export(client):
    """The tenant audit trail downloads as CSV (header + every row)."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    employer = await login_user(client, EMPLOYER_EMAIL)
    emp_id = await find_employee_id(client, supervisor, "Carlos Early")
    created = await client.post(
        f"/api/evaluations/{emp_id}/weekly",
        headers=supervisor,
        json={c: 4.0 for c in COMPETENCIES},
    )
    assert created.status_code == 201, created.text

    resp = await client.get("/api/evaluations/audit-trail.csv", headers=employer)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in resp.headers["content-disposition"]

    lines = [ln for ln in resp.text.splitlines() if ln]
    assert lines[0] == (
        "Recorded (Asia/Manila),Employee,Competency,Evaluator,Prior score,New score"
    )
    assert len(lines) >= 2, "a submitted rating must appear in the export"
    assert "Carlos Early" in resp.text
