# Design Decisions & Scope Notes

This file records decisions made while reconciling the implementation with the
capstone manuscript and `ARCHITECTURE.md`, so future work does not "fix" things
that were intentionally scoped.

## UI overhaul — 2 themes + Split layout

**Decision:** The design system is reduced to **two curated themes** — `paper`
(light) + `graphite` (dark, black/white) — with a **Light / Dark / System** mode
toggle. This
supersedes the earlier 5-theme set (`paper`, `midnight`, `dusk`, `mist`, `sage`);
`AGENTS.md` §1.9 is updated accordingly. Geometry is **soft** (6–8px radii),
hairline rules, **no card shadows**; accent = identity only, colour = status only.
The **Employees** flow uses a **Split (master–detail)** layout — list left, record
right, folding `EmployeeDetail` into the right pane. The record pane uses a
**Reading-width sheet** (900px centered column) with a **sticky record header** and
**flat hairline sections** (no floating cards). Other pages adopt the visual
language only. Mockups live in `performa-minimal/overhaul.html` and
`performa-minimal/split-polish.html`.

## J2 — Competency model (fixed 5 vs configurable KPIs)

**Decision:** The **five statutory competencies are fixed** (`task_completion`,
`attendance_and_punctuality`, `communication_and_teamwork`,
`initiative_and_adaptability`, `quality_of_work`). "KPI configuration" means
customizing each competency's **target score** and **weight** per tenant, plus
selecting from the industry **template presets** (`/api/kpi-rubrics/templates`).
Arbitrary per-role KPI creation is **out of scope**.

Rationale: Article 296 and `ARCHITECTURE.md` fix the competency categories; the
Random Forest model is trained on exactly these five features.

## J4 — Tenant / partner naming

**Decision:** The seed and demo tenant remains **"Acme Philippines Corp."**
(slug `acme-ph`) with demo accounts (`@acme.com`). The production partner
(Small Steps Learning Center) provisions its own `Organization` row; no rename
was performed.

Tenants are now provisioned in-app (Option A, multi-tenant): the Administrator
creates an Employer and supplies the organization name
(`POST /api/admin/users` with `organization_name`), which creates a new
`Organization` with an **empty** workspace; the platform Admin's account list
(`GET /api/admin/users`) and activity log are platform-wide. An Admin/Employer
may rename their own tenant via `PATCH /api/organization`. The UI reads
`user.organization_name` (falling back to `organization_id`) where the tenant is
shown.

## E16 — Account self-registration (Employer only; new tenant)

**Decision:** Employers may self-register at `/register`
(`POST /api/auth/register`, public): the registrant becomes the Employer owner of
a **brand-new tenant** and is signed in immediately. A duplicate email, or a
tenant name already in use, is rejected (409) — the account is never silently
attached to an existing workspace. Administrator provisioning
(`POST /api/admin/users`) is unchanged; self-registration is additive.

## D1–D4 — KPI score-band / weight + dashboard UX invariants

**Decision (owner-approved):** Four invariants from the UX/logic audit, each
encoded by a new test (`frontend/src/test/ux-invariants.test.jsx`,
`backend/tests/guardrails/test_kpi_weights.py`).

- **D1 — Score bands are half-open.** The four bands tile 1.00–5.00 with an
  exclusive upper edge — `1.0 – <3.0` Unsatisfactory, `3.0 – <4.0` Developing,
  `4.0 – <4.6` Proficient, `4.6 – 5.0` Exemplary — so every 2-decimal overall
  score falls in exactly one band. The Proficient floor is `TARGET` from
  `config/domain.js` (not a literal) and the "(target)" suffix is dropped: targets
  are per competency and each row already prints "Target X / 5.0".
- **D2 — Weights are relative shares.** `routers/evaluations.py` normalizes by the
  total weight, so weights need not sum to 1.0. The KPI page keeps the "weights are
  relative" note and no longer warns that they "should sum to 100%"; the total is
  shown neutrally. Scoring math is unchanged.
- **D3 — Total weight must stay > 0.** A write that would leave the organization's
  total weight at 0 is rejected (422), because a zero total silently falls back to
  the unweighted mean and ignores the employer's configuration. The per-row route
  `PUT /api/kpi-rubrics/{competency}` enforces this per row; the UI instead saves
  the whole set through `PUT /api/kpi-rubrics` (**bulk**), which applies all rows in
  a single transaction and validates the final total — so a save is all-or-nothing
  and shifting weight between competencies no longer hits a transient 0. Direct
  per-row API callers can still hit that transient-0 rejection; new callers should
  prefer the bulk route.
- **D4 — Dashboard status/actions.** (a) The "Past cap" figure carries the bad
  tone only when its value is > 0 (no dot at zero). (b) Each item under
  "Interventions / Training plans pending sign-off" links to the Rollups & AI Plans
  route (`config/nav.js`) to act on it, with a "View all N pending" link when the
  list is truncated to 3.

## Alembic migrations

Alembic is configured (`alembic.ini`, `backend/migrations/`). The initial
revision `0001_baseline` materializes the full ORM schema via `Base.metadata`,
so newly added models are captured on a fresh `alembic upgrade head`. For
existing databases, recreate or add explicit revisions for incremental changes.
See `docs/DEPLOYMENT.md`.

## Authentication transport

Tokens are delivered as an **httpOnly `access_token` cookie** (`SameSite=Lax`;
`Secure` via `COOKIE_SECURE`). API clients may still use the
`Authorization: Bearer` header. The frontend also mirrors the token in
`localStorage` (`performa_token`) as a dual-mode fallback and sends it as a Bearer
header; only the non-sensitive user profile is cached in `performa_user`.

## Dataset

The ML model trains on synthetic data by default. A real dataset can be supplied
via `TRAINING_DATASET` (CSV with one column per competency); labels are derived
with the same priority cascade.
