# Performa — System Test (UAT) Matrix

**Purpose.** Per-account, end-to-end verification of every role and module before
the defense. This catches *state-consistency* bugs that unit/component tests miss
(e.g. a regularized employee still showing a pre-decision AI verdict).

**Environment.**
- Backend: `uvicorn backend.main:app --reload` → `http://localhost:8000`
- Frontend: `npm run dev` (workdir `frontend/`) → `http://localhost:5173`
- Fresh seed: `python -m backend.seed` (or the documented seed command), DB migrated with `alembic upgrade head`.

**Accounts.** Password for all seeded accounts is `Password123!`.

| Account | Role | Notes |
|---|---|---|
| `admin@acme.com` | System Administrator | system/IT oversight only |
| `employer@acme.com` | Employer | full operational oversight |
| `supervisor@acme.com` | Supervisor | assigned direct reports only |
| `emp1@acme.com` | Probationary Employee | Carlos Early — early tenure |
| `emp2@acme.com` | Probationary Employee | Maria Midterm — mid tenure |
| `emp4@acme.com` | Probationary Employee | Ana Urgent — past Day 180 / terminal |

**How to run.** Drive the live app with the Playwright browser tool (or manually),
one account at a time. Record **P** (pass), **F** (fail — file a bug with repro),
or **N/A**. Fill the result column as you go.

---

## A. System Administrator (`admin@acme.com`)

| ID | Flow | Expected | Result |
|---|---|---|---|
| A1 | Sign in | Redirects to `/admin/users` | |
| A2 | Create Employer + organization name | New tenant workspace created, account listed | |
| A3 | Create Supervisor (assign organization) | Account listed, role = supervisor | |
| A4 | Create Probationary Employee | Account listed, role = employee | |
| A5 | Deactivate / reactivate; reset password | Status toggles; reset succeeds | |
| A6 | Activity log (`/admin/activity`) | Actions listed with actor + timestamp | |
| A7 | KPI Rubrics (`/rubrics`) | Loads **read-only** — no target/weight inputs, no Apply/Reset/Save | |
| A8 | RBAC — employee data | No nav to employee records; direct `/employees/:id` blocked; API returns 403 | |
| A9 | RBAC — audit trail | Cannot open Evidentiary Labor Score Audit Trail | |

## B. Employer (`employer@acme.com`)

| ID | Flow | Expected | Result |
|---|---|---|---|
| B1 | Dashboard | KPI cards, Day 150/165/178 alerts, pipeline | |
| B2 | Onboard employee | Auto Day 180 computed; appears in directory | |
| B3 | KPI Configuration (`/rubrics`) | Edit target (≥4.0)+weight; **Apply template**; **Reset to defaults**; weight total badge | |
| B4 | Weekly rating | Submit ratings across 5 competencies | |
| B5 | Rollups | Generate monthly Gemini summary; dispatch | |
| B6 | Training plan | Approve / reject a pending plan | |
| B7 | **Regularize** (Ana Urgent) | Hero shows **Final record** (not critical window); Recommendation shows **decision** ("Regularized"), AI demoted to "generated before this decision"; no Generate button | |
| B8 | **Terminate** | Reason is required; reason displayed as "Non-regularization reason" | |
| B9 | Export report | DOLE print/HTML report opens with all scores + rationale | |
| B10 | Audit trail | Immutable entries; no edit/delete affordance | |
| B11 | Settings | Theme switch (Light/Dark/System), org rename | |

## C. Supervisor (`supervisor@acme.com`)

| ID | Flow | Expected | Result |
|---|---|---|---|
| C1 | Dashboard | Scoped to assigned direct reports only | |
| C2 | Weekly rating + remarks | Saved; remarks appear on the employee record | |
| C3 | KPI Rubrics (`/rubrics`) | Read-only (no edit controls) | |
| C4 | RBAC | Cannot see employees not assigned to them | |
| C5 | RBAC | No regularize/terminate controls | |

## D. Probationary Employee (`emp1`, `emp2`, `emp4`)

| ID | Flow | Expected | Result |
|---|---|---|---|
| D1 | Dashboard | 180-day countdown, scorecard, month-by-month, checklist | |
| D2 | Acknowledge standards | Recorded; date shown | |
| D3 | Monthly summaries | Gemini `performance_summary` text shown; **Acknowledge** works | |
| D4 | Supervisor remarks | Weekly narrative visible | |
| D5 | Training plans | Assigned plans listed | |
| D6 | RBAC | Self-scoped only; no directory/admin/other employees | |
| D7 | **Ana Urgent terminal** | Own view reflects final decision, not a stale AI verdict | |

## E. Terminal-state regression (bug fixed this cycle)

| ID | Flow | Expected | Result |
|---|---|---|---|
| E1 | Regularized employee record | Hero: "Final record"; Recommendation: decision authoritative; AI output labelled pre-decision; no Regenerate | |
| E2 | Terminated employee record | Reason shown; recommendation demoted | |
| E3 | Directory / rollups | Terminal status reflected (Regularized/Terminated) | |

## F. Cross-cutting invariants

| ID | Check | Expected | Result |
|---|---|---|---|
| F1 | All business dates | `Asia/Manila` — no UTC drift in day counts | |
| F2 | Explainability visible | "Random Forest", "Feature Importance", "Gemini Performance Rationale" present | |
| F3 | No fake data | Every value from API; empty/loading states where missing | |
| F4 | RBAC server-side | Direct API calls outside role return 403 (not just hidden UI) | |
| F5 | Design system | Role selection uses one accent token; keyboard focus visible; AA contrast | |

---

## Results log

| Cycle | Date | Accounts covered | Failures | Fixed |
|---|---|---|---|---|
| 1 | | | | |
