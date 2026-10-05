# Design Decisions & Scope Notes

This file records decisions made while reconciling the implementation with the
capstone manuscript and `ARCHITECTURE.md`, so future work does not "fix" things
that were intentionally scoped.

## UI overhaul — 2 themes + Split layout

**Decision:** The design system is reduced to **two curated themes** — `paper`
(light) + `graphite` (dark) — with a **Light / Dark / System** mode toggle. This
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

## E16 — Account self-registration (descoped)

**Decision:** Self-registration is **descoped**. Accounts are provisioned by the
Administrator (Account Management) or via the seed script, consistent with the
manuscript's Administrator scope.

## Alembic migrations

Alembic is configured (`alembic.ini`, `backend/migrations/`). The initial
revision `0001_baseline` materializes the full ORM schema via `Base.metadata`,
so newly added models are captured on a fresh `alembic upgrade head`. For
existing databases, recreate or add explicit revisions for incremental changes.
See `docs/DEPLOYMENT.md`.

## Authentication transport

Tokens are delivered as an **httpOnly `access_token` cookie** (`SameSite=Lax`;
`Secure` via `COOKIE_SECURE`). API clients may still use the
`Authorization: Bearer` header. The frontend no longer stores the token in
`localStorage`; only the non-sensitive user profile is cached there.

## Dataset

The ML model trains on synthetic data by default. A real dataset can be supplied
via `TRAINING_DATASET` (CSV with one column per competency); labels are derived
with the same priority cascade.
