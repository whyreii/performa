# Performa — Backend Debug & Observability Runbook

**Author:** engineering (OpenCode) · **Date:** 2026-10-03
**Scope:** the FastAPI backend (`backend/`) and its client-side diagnostics.
**Counterpart to:** `docs/DESIGN_QA.md`.

This is the persistent audit log of the forensic backend debugging pass plus the
operational runbook for diagnosing Performa in development. All findings are
grounded in `file:line`; every fix is covered by the test suite
(`python -m pytest backend/tests/ -q` → **52 passed**).

---

## Executive summary

A read-only audit of **every backend module** surfaced **18 findings (F1–F18)**;
follow-up PostgreSQL-parity passes added **F19** and **F20**, for **20 findings total**.
They were resolved across four phases:

| Phase | Commit | Focus |
|---|---|---|
| 1 | `c5eebde` | Observability: request-id logging, global error handler, SQL echo, React ErrorBoundary |
| 2 | `46e96f6` | `PERFORMA_TODAY` clock override + statutory boundary tests |
| 3 | `3494d14` | Core statutory & integrity fixes (F1–F4, F8–F10, F13, F15) |
| 4 | `efdaf8f` | Parity/cleanup: dead branches, ML loader, Alembic docs (F6, F17, F18) |

**Findings at a glance**

| ID | Sev | Root cause | Resolution | Location |
|---|---|---|---|---|
| F1 | High | KPI rubric allowed a target below the 4.0 statutory floor | **Code fix** — `ge=4.0` on `target_score` | `backend/schemas.py` |
| F2 | Med | Regularization could be generated before Day 150 | **Code fix** — Day 150 gate (400) | `backend/routers/evaluations.py` |
| F3 | Med | No guard against re-transitioning a terminal employee | **Code fix** — terminal-state guard (400) | `backend/routers/employees.py` |
| F4 | Med | `KpiRubricBase.target_score` defaulted to 3.0 | **Code fix** — default 4.0 | `backend/schemas.py` |
| F5 | Med | `supervisor_id` required by API but nullable in model | **Policy** — intentional distinction | `schemas.py` / `models.py` |
| F6 | Med | Dev used `create_all`; Alembic drift risk | **Verified + documented** | `backend/main.py`, `backend/migrations/` |
| F7 | Med | Industry templates encode 4.5 targets | **Policy** — targets ≥ 4.0 are allowed | `backend/routers/kpi.py` |
| F8 | Med | Monthly rollup allowed non-active employees | **Code fix** — active guard (400) | `backend/routers/interventions.py` |
| F9 | Low | Future-dated weekly ratings accepted | **Code fix** — future-date rejection (400) | `backend/routers/evaluations.py` |
| F10 | Low | Scorecard `gap` mixed weighted target vs unweighted mean | **Code fix** — weighted-vs-weighted | `backend/routers/evaluations.py` |
| F11 | Low | No request logging / exception handler / request ids | **Code fix** — middleware + handler | `backend/main.py` |
| F12 | Low | SQL echo hardcoded off | **Code fix** — `SQL_ECHO` setting | `backend/config.py`, `database.py` |
| F13 | Low | Login DB lookup used the raw (un-normalized) email | **Code fix** — normalized lookup | `backend/routers/auth.py` |
| F14 | Low | Admin could create another Admin | **Policy** — by design (last-admin guarded) | `backend/routers/admin.py` |
| F15 | Low | Seed set `employer_id = admin.id` | **Code fix** — employer account | `backend/seed.py` |
| F16 | Info | `get_current_user` email fallback when `sub` isn't a UUID | **Closed — accepted risk** (signed tokens only; see Residual Risk Register) | `backend/auth.py` |
| F17 | Info | Dead `SUPERVISOR` branch in interventions | **Code fix** — removed | `backend/routers/interventions.py` |
| F18 | Info | ML CSV loader raised `KeyError` on missing columns | **Code fix** — clear `ValueError` | `backend/ml/train.py` |
| F19 | Med | `seed._reset` skipped FK-bearing tables (`Notification`, `ActivityLog`, `RegularizationRecommendation`) → would fail on PostgreSQL (SQLite didn't enforce FKs) | **Code fix** — FK-safe child→parent deletion order | `backend/seed.py` |
| F20 | Med | `0002_unique_constraints` blindly `ADD CONSTRAINT`ed constraints that `0001_baseline` (`create_all`) already created → PostgreSQL "relation … already exists" | **Code fix** — idempotent inspect-based guard | `backend/migrations/versions/0002_unique_constraints.py` |

---

## Article 296 invariants — how they are enforced

1. **Statutory benchmark floor (4.0).** KPI rubric targets are validated with
   `Field(default=4.0, ge=4.0, le=5.0)` on `KpiRubricBase`, `KpiRubricUpdate`,
   and `KpiRubricUpsert` (`backend/schemas.py`). Employers may set **higher**
   company targets (e.g. 4.5) but can never lower the floor below 4.0.
2. **Day 150 gate.** `POST /api/evaluations/{id}/regularization-recommendation`
   refuses requests while `days_elapsed < 150` (HTTP 400) —
   `backend/routers/evaluations.py`.
3. **Terminal status guard.** `PATCH /api/employees/{id}/status` refuses to
   change an employee already in a terminal state (`regularized`/`terminated`)
   — `backend/routers/employees.py`.
4. **Active-only rollups.** `POST /api/interventions/{id}/monthly-rollup`
   refuses non-active employees — `backend/routers/interventions.py`.
5. **No future ratings.** Weekly ratings dated after `min(today, day_180)` are
   rejected — `backend/routers/evaluations.py`.
6. **Timezone.** Business dates use `backend.timeutils.manila_today()`; no
   business date is derived from `datetime.now(timezone.utc)`.

---

## Observability runbook

### 1. Request correlation (`X-Request-ID`)
Every response carries an `X-Request-ID` header, and every request emits one
access-log line:

```
2026-10-03 23:00:22,179 INFO performa.request: GET /health -> 200 (1.38ms) [req_id=6e315923-…]
```

Unhandled exceptions log the full traceback (with the same `req_id`) and return
a safe body — no traceback is leaked to the client:

```json
{ "detail": "An internal server error occurred.", "request_id": "…" }
```

**To correlate:** grab `request_id` from the browser response/console, then
grep the backend log for `[req_id=<value>]`.

### 2. Query logging (`SQL_ECHO`)
```powershell
$env:SQL_ECHO = "1"
python -m uvicorn backend.main:app --reload --port 8000
```
`backend/database.py` passes `echo=settings.sql_echo` to `create_async_engine`,
so every emitted SQL statement is printed. Unset `SQL_ECHO` to silence it.

### 3. Client-side diagnostics
- **React ErrorBoundary** (`frontend/src/components/ErrorBoundary.jsx`) catches
  render/lifecycle errors and shows a token-styled fallback with a *Reload
  Application* button; the error is logged via `componentDidCatch`. In dev the
  message is surfaced in the fallback; in production it is hidden.
- **Global traps** (`frontend/src/main.jsx`) register `window` `error` and
  `unhandledrejection` listeners (console only).
- **Dev Axios logging** (`frontend/src/api.js`) logs `method`, `URL`, `status`,
  and duration for every request when `import.meta.env.DEV` is true.

---

## Temporal simulation guide (`PERFORMA_TODAY`)

`backend.timeutils.manila_today()` honors a `YYYY-MM-DD` override, so statutory
state can be simulated deterministically:

```powershell
$env:PERFORMA_TODAY = "2026-06-15"
python -m uvicorn backend.main:app --reload --port 8000
```

The override is ignored (with a warning) when malformed, and test runs are
guaranteed clean via the autouse `_clear_performa_today` fixture in
`backend/tests/conftest.py`.

**Boundary matrix** (employee start = Day 0; verified in
`backend/tests/test_milestones.py`):

| Day | 150 reached | 165 reached | 178 reached |
|---|---|---|---|
| 149 | ✗ | ✗ | ✗ |
| 150 | ✓ | ✗ | ✗ |
| 164 | ✓ | ✗ | ✗ |
| 165 | ✓ | ✓ | ✗ |
| 177 | ✓ | ✓ | ✗ |
| 178 | ✓ | ✓ | ✓ |

To reproduce by hand: pick an employee, set `PERFORMA_TODAY` to
`start_date + N days`, then `GET /api/employees/milestones` and inspect the
`day_150_reached` / `day_165_reached` / `day_178_reached` flags.

---

## Database migration guide

Dev defaults to **SQLite** (`sqlite+aiosqlite:///./performa.db`); production
supports **PostgreSQL** via the `DATABASE_URL` override.

- **Dev startup** uses `Base.metadata.create_all` (`backend/main.py` lifespan),
  which is idempotent and only creates missing tables.
- **Schema ownership is Alembic** (`backend/migrations/`):
  - `0001_baseline` — materialises the ORM schema (`create_all`).
  - `0002_unique_constraints` — adds `uq_monthly_summary_employee_month` and
    `uq_kpi_rubric_org_competency` via `batch_alter_table`, guarded by an
    inspect-based existence check (**idempotent**, so it is safe whether or not
    `0001` already created them — see F20).

**Apply + verify**
```powershell
# DATABASE_URL is optional — env.py defaults to the app's configured SQLite URL.
python -m alembic upgrade head
python -m alembic current      # -> 0002_unique_constraints (head)
# ...or target another database:
$env:DATABASE_URL = "postgresql+asyncpg://user:pass@host:5432/performa_db"
python -m alembic upgrade head
```

For a pre-existing database created by `create_all`, `0001` is a no-op and
`0002` applies the constraints. Verified clean on both a **fresh** and an
**existing** SQLite database, and idempotent on re-run. The same commands work
against PostgreSQL by pointing `DATABASE_URL` at the Postgres instance (CI runs
the suite against a Postgres service container).

**Foreign-key enforcement in tests.** The SQLite test harness enables
`PRAGMA foreign_keys=ON` (a `connect` event on `engine.sync_engine` in
`backend/tests/conftest.py`), so local runs catch FK-ordering bugs that
PostgreSQL would reject — matching the `backend-postgres` CI job. This is what
surfaced **F19** (`seed._reset` skipping FK-bearing tables), now fixed.

**Drift check** (optional): `python -m alembic revision --autogenerate -m "drift"`
and inspect the generated file for unexpected diffs before committing.

---

## Residual Risk Register

This register is the honest boundary of what the current verification covers. It
is maintained alongside the findings catalog and should be cited **as-is** in the
manuscript — **never** as a "zero defects" claim.

| ID | Residual risk | Impact | Likelihood | Mitigation / status |
|---|---|---|---|---|
| **R1** | **SQLite (dev) vs PostgreSQL (prod) parity** — engine-specific SQL/enum/constraint/**FK** behavior | Med | **Low (CI-verified)** | The suite runs on **both** engines in CI: `backend` (SQLite) and `backend-postgres` (Postgres 16 + `alembic upgrade head`). **All three jobs pass on `159c563`** — the prod engine is CI-verified. Two parity bugs were caught and fixed this way: **F19** (FK-safe `seed._reset`) and **F20** (idempotent `0002` migration). SQLite tests enforce FKs locally. Dev still defaults to SQLite; `performa.db` is `create_all`-built, not Alembic-stamped. |
| **R2** | **No frontend automated E2E tests** — React integration/UX regressions could ship | Med | Med | A **Vitest + Testing Library** unit suite now covers the core primitives (`TimelineDocket`, `ScoreLedger`, `MilestoneComposition`, `datetime`) and runs in CI (`npm test`). Compensating controls for the rest: manual **Design QA** sweeps, React **ErrorBoundary**, dev-only **Axios logging**, and `npm run build` in CI. Full **E2E (Playwright) is still deferred**. |
| **R3** | **Single-threaded, in-memory Random Forest inference** — throughput/latency under concurrency; model staleness | Low | Low | One `lru_cache`d model per process, no batching/GPU. Acceptable for a single-tenant SME capstone; revisit for scale. Model is trained on synthetic data. |
| **R4 (F16)** | **JWT email fallback on non-UUID `sub`** — a token could resolve a user by email instead of id | Very Low | Very Low | **Accepted risk (closed).** Tokens are signed (HS256); a forged `sub` cannot pass signature verification. The fallback is a legacy/dev convenience only. |
| **R5** | **Coverage gap** — untested error paths and CLI scripts | Med | Med | Verified baseline (`python -m pytest backend/tests/ --cov=backend`): **92% total / 88% source-only** statement coverage (the earlier 71% figure was a stale local `.coverage` artifact). Lowest files: `gemini.py` 45% (fallback/network branches), `seed.py` 65% (CLI), `ml/train.py` 71% (CLI), `admin.py` 78%. |

**F16 resolution:** closed as an **accepted, low-risk** design convenience
(signed-token model), documented here rather than changed.

---

## Verification protocol

```powershell
python -m pytest backend/tests/ -q      # 52 passed
npm run build                            # in frontend/ ; 0 errors
```

Both must pass before any backend change lands.
