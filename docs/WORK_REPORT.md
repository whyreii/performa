# Performa — Gap Remediation Work Report

_Generated for external review. Scope: resolve the full frontend/backend gap
register (96 IDs across categories A–J plus manuscript modules E1–E16)._

## 0. Summary

Resolved the complete gap register with a new pytest suite (**29 tests passing**)
and a clean frontend production build. All work is committed to `main`; baseline
tag `baseline/pre-gapfix` (`b3d75d8`) is the revert point. Nothing was pushed.

## 1. Method & guardrails

- Started from `main` @ `b3d75d8`; created tag `baseline/pre-gapfix`; did all
  work on branch `fix/gap-remediation`; later fast-forwarded into `main` and
  deleted the local branch.
- Committed in small logical units (one per gap group) for individual revert.
- No force-push, no remote writes. `origin/fix/gap-remediation` exists because
  it was pushed externally; left untouched.
- One commit `d0e99c0 "Create timeutils.py"` was authored by an external
  auto-committer, not by me.

## 2. Gaps resolved (by wave)

### Wave 1 — P0 (broken flows)
- **A1** onboarding: added `GET /api/employees/supervisors` + supervisor picker;
  payload sends `supervisor_id` (was 422).
- **A2/B9** scorecards render real `competencies[]` (were fabricated hardcoded
  scores); fixed zero/falsy masking.
- **A3** audit lists render `evaluator_name/competency/prior_score/new_score`
  (were blank).
- **A4/A11** employee-scoped `GET /api/interventions/mine` (approved-only) +
  rewired EmployeeTraining.
- **A5/A6** employer dashboard uses `listPending()` and correct plan fields.
- **B1** 403 page no longer auto-redirects to login.
- **C11** `/health` verifies DB connectivity (503 if down).

### Wave 2 — P1 (correctness/authorization)
- **A7** terminate requires reason (UI + backend); **A8** ack button only for the
  employee; **A9** admin removed from rating.
- **B2** admin nav/tabs/command-palette corrected; **B3** real
  `POST /api/auth/change-password`; **B4** PB can open own detail.
- **C1/C14** supervisors restricted to assigned employees.
- **C2/C7** email uniqueness global → 409; **C6** empty scorecard → 404;
  **C13** supervisor can read pending interventions.
- **D1–D3** RBAC matrix aligned.

### Wave 3 — P2/P3 hardening
- Backend: **C3** rollup idempotent, **C4** month-window filtering, **C5** Manila
  eval dates, **C8** last-active-admin guard, **C9** safe `verify_password`,
  **C12** audit pagination, **C15** unknown-tier logging, **C16** Gemini key at
  call time, **F4** dead schema removed, **F5** index, **I3** shared timezone util.
- Frontend: **B5** complete directory fetch, **B6** dead filter/sort removed,
  **B7/B8** shared Manila datetime util, **B10** error states, **B11** StatusDot
  size, **B12** dialog semantics + Esc-to-close, **B13** dusk theme,
  **B14/H1–H6** copy accuracy, **I1/I2/I4** dead code.
- Ops: **G3** insecure-secret warning, **G4** login throttle, **G5** env CORS,
  **G7** logging config, **G9** dependency pins, **G10** CI, **J1** docstring.

### Wave 4 — data model/deploy
- **G2** Alembic migrations; **F1** FK `users.organization_id →
  organizations.slug`; **F2** indexes; **F3** `weekly_evaluations.week_number`;
  **G12** TLS/deployment docs.

### Wave 5 — missing manuscript modules
- **E1/E14** KPI rubric configuration (targets/weights + industry templates);
  scorecard uses configured targets.
- **E2** regularization recommendation (mid-5th-month, AI rationale).
- **E3** printable HTML report.
- **E4** monthly-summary dispatch + employee acknowledgement.
- **E5** in-app notifications (on dispatch and plan sign-off).
- **E6/E7** admin system settings + tenant overview reports.
- **E8** general activity log (logins, user/employee CRUD, ratings, rollups,
  sign-offs, dispatch/ack).
- **E9** ML risk explainability (feature importances).
- **E10** profile self-update.
- **E12** supervisor regularization view (scoped GET).
- **E13** monthly KPI trend reporting.
- **E15** real-dataset adapter (`TRAINING_DATASET` CSV, synthetic fallback).
- **E16** account self-registration → descoped (manuscript ambiguity; documented).

### Deferred (completed last)
- **G6** centralized config (pydantic-settings); **G8** httpOnly cookie auth
  (token removed from localStorage); **A10/J3** OpenAPI→TypeScript types;
  **J2/J4** scope decisions documented; **B12** Esc-to-close.

## 3. Backend changes

- **Config**: `backend/config.py` (pydantic-settings: DB URL, secret, token
  expiry, Gemini key, CORS, log level, cookie secure). `database.py`, `auth.py`,
  `main.py`, `gemini.py` read from it.
- **Auth**: JWT; header **or** httpOnly `access_token` cookie; login throttle
  (5 failures/5 min → 429); `POST /login` sets cookie, `POST /logout` clears it;
  `GET/PATCH /me`; `POST /change-password`.
- **Models**: added `Organization`, `RegularizationRecommendation`,
  `ActivityLog`, `Notification`; `WeeklyEvaluation.week_number`;
  `MonthlySummary.dispatched_at/acknowledged_at`; tenant FK + indexes.
- **Helpers**: `backend/timeutils.py`, `backend/audit.py`, `backend/notifications.py`.
- **ML**: predictor returns `feature_importances`; trainer supports CSV dataset.
- **Endpoints added/changed**:
  - Auth: `POST /api/auth/login|logout`, `GET|PATCH /api/auth/me`,
    `POST /api/auth/change-password`
  - Admin: `GET|POST /api/admin/users`, `PATCH /api/admin/users/{id}/status`,
    `POST /api/admin/users/{id}/reset-password`, `GET /api/admin/activity`,
    `GET /api/admin/settings`, `GET /api/admin/reports/overview`
  - Employees: `POST /api/employees/`, `GET /api/employees/`,
    `GET /api/employees/milestones`, `GET /api/employees/supervisors`,
    `GET /api/employees/{id}`, `POST /api/employees/{id}/acknowledge-standards`,
    `PATCH /api/employees/{id}/status`
  - Evaluations: `POST /api/evaluations/{id}/weekly`,
    `GET /api/evaluations/{id}/scorecard`,
    `GET /api/evaluations/{id}/risk-explanation`,
    `GET /api/evaluations/{id}/trend`,
    `GET|POST /api/evaluations/{id}/regularization-recommendation`,
    `GET /api/evaluations/{id}/report`, `GET /api/evaluations/audit-trail`,
    `GET /api/evaluations/{id}/audit-trail`
  - Interventions: `POST /api/interventions/{id}/monthly-rollup`,
    `GET /api/interventions/mine`, `GET /api/interventions/summaries`,
    `GET /api/interventions/summaries/mine`,
    `POST /api/interventions/summaries/{id}/dispatch`,
    `POST /api/interventions/summaries/{id}/acknowledge`,
    `GET /api/interventions/pending`, `POST /api/interventions/{id}/sign-off`
  - KPI: `GET /api/kpi-rubrics`, `GET /api/kpi-rubrics/templates`,
    `PUT /api/kpi-rubrics/{competency}`, `POST /api/kpi-rubrics/reset`
  - Notifications: `GET /api/notifications`,
    `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`
  - System: `GET /`, `GET /health` (DB check)
- **Seed**: idempotent child→parent teardown; org + admin/employer/supervisor +
  4 probationary employees at Day 30/152/166/179.

## 4. Frontend changes

- **API client**: `withCredentials`, 401 handling, methods for
  auth/employees/evaluations/interventions/kpi/notifications/admin.
- **Auth**: cookie-based; validates via `/me`; no token in localStorage;
  `refreshUser`.
- **New pages**: Notifications, admin ActivityLog, admin AdminOverview.
- **New utilities**: `utils/datetime.js`, `hooks/useEscapeKey.js`,
  `types/api.d.ts` (generated).
- **Updated pages**: Login, Employees, EmployeeDetail (real scorecard/audit,
  report export, trend, regularization, risk explanation, terminate reason),
  EmployeeDashboard (real scorecard/audit, summary acknowledgement),
  EmployeeTraining (own approved plans), employer Dashboard/Rollups (real plans +
  summary dispatch), SupervisorDashboard/RateEmployee/Rubrics (DB
  targets/weights), admin UserManagement/AuditTrail, Settings (profile edit +
  real password change).
- **Nav/shell**: Sidebar/BottomTabBar/CommandPalette role-aware; deleted unused
  `AppLayout.jsx` and empty `ForgotPassword.jsx`.

## 5. Database / migrations

- Alembic (`alembic.ini`, `backend/migrations/env.py`,
  `versions/0001_baseline.py`); async env; baseline materializes full ORM schema.
- Added tenant FK, indexes, and new tables. `alembic upgrade head` verified on
  SQLite.

## 6. Ops / CI / docs

- `.github/workflows/ci.yml` (backend pytest + frontend build).
- `backend/requirements.txt` pinned (PyJWT, passlib, bcrypt<5, alembic).
- `docs/DEPLOYMENT.md` (migrations, TLS/reverse-proxy, env vars),
  `docs/DECISIONS.md` (J2/J4/E16 + auth/dataset notes).

## 7. Tests & verification evidence

- `python -m pytest -q` → **29 passed**:
  - `test_wave1_contracts.py` — onboarding, scorecard/audit shape, employee
    interventions, health
  - `test_wave2_authz.py` — supervisor scoping, terminate reason, password
    change, email conflict, supervisor pending
  - `test_wave3_backend.py` — rollup month filtering + idempotency, audit
    pagination, verify_password
  - `test_wave5_features.py` — risk explanation, profile update, KPI rubrics,
    regularization, summary dispatch/ack, activity log, trend, notifications,
    report, admin settings/reports, cookie auth/logout
- `npm run build` → success.
- `python -m alembic upgrade head` (SQLite) → tables + FK + `week_number` +
  indexes confirmed.
- Tests run against SQLite (aiosqlite); asyncpg/Postgres unavailable locally.

## 8. Decisions & descopes

- **J2**: the five competencies are fixed; KPI config adjusts targets/weights +
  templates (not arbitrary KPIs).
- **J4**: demo tenant stays "Acme Philippines Corp."; production partner
  provisions its own org.
- **E16**: self-registration descoped (admin-provisioned accounts).
- **Alembic**: `create_all` baseline; new models captured on fresh upgrade;
  incremental revisions recommended for deployed DBs.

## 9. Known limitations / not done

- No live PostgreSQL/asyncpg locally; migrations/tests validated on SQLite only.
- Generated TS types are informational (app is JS/JSX, no TS build).
- `SECRET_KEY` default is a dev placeholder (warning logged).
- CI workflow added but not executed here.
- External auto-committer touched the repo once (`d0e99c0`).

## 10. Files changed (name-status)

- **Added**: `.github/workflows/ci.yml`, `alembic.ini`, `backend/config.py`,
  `backend/timeutils.py`, `backend/audit.py`, `backend/notifications.py`,
  `backend/routers/kpi.py`, `backend/routers/notifications.py`,
  `backend/migrations/{env.py,script.py.mako,README,versions/0001_baseline.py}`,
  `backend/tests/{conftest.py,test_wave1_contracts.py,test_wave2_authz.py,test_wave3_backend.py,test_wave5_features.py}`,
  `pytest.ini`, `frontend/src/utils/datetime.js`,
  `frontend/src/hooks/useEscapeKey.js`,
  `frontend/src/pages/notifications/Notifications.jsx`,
  `frontend/src/pages/admin/{ActivityLog,AdminOverview}.jsx`,
  `frontend/src/types/api.d.ts`, `frontend/openapi.json`,
  `docs/DEPLOYMENT.md`, `docs/DECISIONS.md`
- **Modified**: backend `database.py, auth.py, gemini.py, main.py, models.py,
  schemas.py, seed.py, requirements.txt, ml/predictor.py, ml/train.py,
  routers/{auth,admin,employees,evaluations,interventions}.py`; frontend
  `App.jsx, api.js, package.json, package-lock.json, tailwind.config.js,
  context/AuthContext.jsx, components/{employees/AddEmployeeModal,layout/Sidebar,layout/BottomTabBar,layout/CommandPalette,ui/StatusDot}.jsx`,
  `pages/...`
- **Deleted**: `frontend/src/layouts/AppLayout.jsx`,
  `frontend/src/pages/auth/ForgotPassword.jsx`

## 11. Commit list

`git log --oneline baseline/pre-gapfix..HEAD` (29 commits), including:

```
a96b7a0 chore(contract): generate TS types from OpenAPI + record scope decisions (A10, J2, J3, J4)
b37a0ef feat(auth): httpOnly cookie auth with header fallback; drop token from localStorage (G8)
2e90264 feat(frontend): Escape-to-close for modals via shared hook (B12)
f7e84d5 refactor(api): centralize configuration with pydantic-settings (G6)
449e2c5 feat(frontend): admin system overview, activity nav, ML risk explanation display (E6, E7, E9)
18b688a feat(frontend): notifications, activity log, report export, trends, regularization, summary ack (E2-E5, E8, E13)
086e25f feat(api): printable HTML report, admin settings/reports, dataset adapter (E3, E6, E7, E15; E12 via scoped GET)
4373027 feat(api): in-app notifications with dispatch/sign-off emission (E5)
9116f43 feat(api): monthly KPI trend reporting (E13)
78259e5 feat(api): general system activity log with admin listing (E8)
7468efc feat(api): monthly summary dispatch and employee acknowledgement (E4)
9131d5f feat(api): regularization recommendation at mid-5th month (E2)
3889876 feat(frontend): profile self-update form and KPI rubric targets/weights (E1, E10, E14)
5da4b16 feat(api): Wave 5 backend - risk explainability, profile self-update, KPI rubric config (E1, E9, E10, E14)
e69741c feat(db): Alembic migrations, tenant FK, week_number, indexes, TLS docs (G2, F1-F3, G12)
7acdb58 chore(ops): env CORS/logging, secret warning, login throttle, dep pins, CI (G3-G5, G7, G9, G10, J1)
... (Wave 1–3 commits)
```

## 12. How to verify

```bash
# backend
python -m pytest -q
# frontend
cd frontend && npm run build
# migrations (SQLite stand-in)
DATABASE_URL="sqlite+aiosqlite:///./verify.db" python -m alembic upgrade head
```
