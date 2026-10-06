# Performa

**Performance-evaluation and regularization decision-support for Philippine SMEs under
Article 296 of the Labor Code (the 180-day probationary cap).**

Performa turns weekly competency ratings into a defensible, auditable record: it tracks the
statutory probation timeline, classifies competency risk with a Random Forest, recommends
catalog interventions, drafts a plain-language rationale with Google Gemini, and keeps a
human (the Employer) in the loop for every approval and regularization decision.

> **Authoritative values live in [`ARCHITECTURE.md`](ARCHITECTURE.md)** (milestone days, the
> 4.0 standard, competency identifiers, model IDs, pipeline). **Working rules live in
> [`AGENTS.md`](AGENTS.md)** (invariants, RBAC, how to work). This README is an overview only —
> where it and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins.

---

## What it is / isn't

- **Decision *support*, not decision-making.** The system recommends; the Employer decides.
  Every transition out of `pending_approval` is gated by a server-side role check.
- **Explainable by design.** The UI keeps "Random Forest", "Feature Importance", and the
  Gemini rationale visible — the model's reasoning is part of the deliverable.
- **No surveillance.** Attendance is an evaluator rating score only. No biometrics, no punch
  clocks, no leave requests.

## Legal invariants (Article 296)

The domain rules are fixed constants, not settings. The full set and the day-count convention
are in [`ARCHITECTURE.md` §2 and §6a](ARCHITECTURE.md):

- A **180 calendar-day probation cap**, computed in `Asia/Manila`.
- Fixed review milestones that each fire an automated alert.
- A **hard regularizing floor of 4.0 / 5.0** across exactly **five** statutory competencies
  (Employers may set *higher* targets, never lower).
- Every score change appends an **immutable** audit record; monthly rollups lock (HTTP 409)
  once dispatched or acknowledged.

All business dates use `Asia/Manila`; the backend helper is `backend/timeutils.py`
(`manila_today()`) and the frontend equivalent is `src/utils/datetime.js`.

## Roles (RBAC)

Enforced **server-side on every endpoint** — hiding UI is not access control. The full matrix
is in [`AGENTS.md` §2](AGENTS.md).

| Role | Scope |
|---|---|
| **System Administrator** | System/IT oversight only (`/admin/*`, `/settings`, `/notifications`) plus the KPI rubric library (view-only). **No** access to employee performance data. |
| **Employer** | Full operational oversight; exclusive regularization/termination sign-offs and intervention approvals. |
| **Supervisor** | Weekly ratings and scorecards for assigned direct reports only. |
| **Probationary Employee** | Self-scoped dashboard, notifications, and acknowledgment of monthly summaries. |

## Two separate audit trails

Never merged, never removed ([`ARCHITECTURE.md` §5](ARCHITECTURE.md)):

- **Evidentiary Labor Score Audit Trail** (`/audits`) — immutable, append-only; one row per
  changed competency (evaluator, employee, prior score, new score, timestamp). Built for
  DOLE/NLRC defense.
- **IT System Activity Log** (`/admin/activity`) — security and system activity for the Admin.

## Pipeline

```
weekly ratings ─▶ monthly rollup ─▶ Random Forest classification ─▶ catalog mapping
                                                                          │
                                       Gemini: 2-sentence summary + 1-sentence rationale per item
                                                                          │
                                          human-in-the-loop: Employer approves / rejects
```

Gemini **only** writes the summary and rationales — it never selects, adds, removes, or
reorders interventions. If Gemini is unavailable the catalog items still save (with empty
rationales); saving is never blocked by the AI.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 (Vite SPA), Tailwind CSS, TanStack Query. Design tokens in `frontend/src/tokens.css` |
| Backend | Python 3.12, FastAPI (async), SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | SQLite (`aiosqlite`) locally; PostgreSQL (`asyncpg`) via `DATABASE_URL` |
| ML | scikit-learn Random Forest (+ exact Shapley and permutation importance for explanations) |
| GenAI | Google Gemini (async) |
| Auth | JWT bearer tokens + httpOnly cookie, four roles |

## Project layout

```
backend/        FastAPI app, routers, ORM models, ML, Gemini, migrations, tests
  ml/           train.py, predictor.py, explain.py, catalog.py
  routers/      auth, admin, employees, evaluations, interventions, kpi, notifications, organization
  tests/        pytest suite (incl. guardrails/ that enforce the invariants)
frontend/       React SPA (src/pages, src/components, src/context, src/utils)
docs/           audits, decisions, deployment, XAI methodology, roadmap
scripts/        gen_architecture_snapshot.py
ARCHITECTURE.md single source of truth for values
AGENTS.md       invariants, RBAC, working rules
```

---

## Setup

### Backend

```bash
python -m venv .venv && . .venv/Scripts/activate    # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# Configure environment (copy and edit)
cp .env.example .env        # set SECRET_KEY (required in prod) and GEMINI_API_KEY
# Local dev uses SQLite by default — leave DATABASE_URL unset, or set
#   DATABASE_URL="sqlite+aiosqlite:///./performa.db"
# `.env.example` shows the PostgreSQL production form.

python -m backend.ml.train  # generate backend/ml/models/rf_model.joblib (not committed)
alembic upgrade head        # apply migrations
python -m backend.seed      # seed the demo tenant + accounts

uvicorn backend.main:app --reload   # http://localhost:8000  (docs at /docs)
```

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :8000)
```

### Seeded demo accounts

All use the password `Password123!`:

| Role | Email |
|---|---|
| Admin | `admin@acme.com` |
| Employer | `employer@acme.com` |
| Supervisor | `supervisor@acme.com` |
| Probationary Employee | `emp1@acme.com` … `emp4@acme.com` |

---

## Testing & quality gates

Run these before any change lands; CI runs them on every push/PR.

```bash
# Backend
python -m ruff check backend                      # lint (flake8-datetimez: no naive datetimes)
python -m pytest backend/tests/ -q                # full suite
python -m pytest backend/tests/guardrails/ -q     # invariant guardrails only

# Frontend
cd frontend
npm run lint
npm run build
```

- **Guardrails** (`backend/tests/guardrails/`) enforce the invariants — competencies, RBAC
  matrix, audit separation, timezone, Gemini scope, human-in-the-loop, ML ordering, docs
  consistency, page-wrapper, and UI contract. They must never be weakened to get a pass.
- **CI** (`.github/workflows/ci.yml`) runs ruff, an Alembic model/migration **drift check**,
  the ML training step, the test suite on **both SQLite and PostgreSQL**, and the frontend
  lint + build.
- The architecture snapshot (`docs/generated/architecture-snapshot.md`) is generated, never
  hand-edited. Regenerate with `python scripts/gen_architecture_snapshot.py`.

## Documentation

| File | Purpose |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Single source of truth for values (stack, domain, pipeline, audit, open items) |
| [`AGENTS.md`](AGENTS.md) | Invariants, RBAC, and the rules for working in this repo |
| [`ROADMAP.md`](ROADMAP.md) | Project roadmap |
| `docs/DECISIONS.md` | Recorded design decisions |
| `docs/XAI_METHODOLOGY.md` | Random Forest + Shapley explainability method |
| `docs/DEPLOYMENT.md` | Deployment notes |
| `docs/FRONTEND_ROADMAP.md` | Frontend quality standard and roadmap |
| `docs/ML_DATA_PLAN.md` | ML dataset collection and evaluation plan |
