# Design Decisions & Scope Notes

This file records decisions made while reconciling the implementation with the
capstone manuscript and `ARCHITECTURE.md`, so future work does not "fix" things
that were intentionally scoped.

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
was performed. The UI reads `user.organization_id` where the tenant is shown.

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
