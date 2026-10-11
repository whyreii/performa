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
or **–** (not run in that cycle).

**Result legend.** `P` pass · `F` fail · `–` not run.

---

## A. System Administrator (`admin@acme.com`)

| ID | Flow | Expected | Result |
|---|---|---|---|
| A1 | Sign in | Redirects to `/admin/users` | P |
| A2 | Create Employer + organization name | New tenant workspace created, account listed | – |
| A3 | Create Supervisor (assign organization) | Account listed, role = supervisor | – |
| A4 | Create Probationary Employee | Account listed, role = employee | – |
| A5 | Deactivate / reactivate; reset password | Status toggles; reset succeeds | – |
| A6 | Activity log (`/admin/activity`) | Actions listed with actor + timestamp | – |
| A7 | KPI Rubrics (`/rubrics`) | Loads **read-only** — no target/weight inputs, no Apply/Reset/Save | P |
| A8 | RBAC — employee data | No nav to employee records; direct `/employees/:id` blocked; API returns 403 | P |
| A9 | RBAC — audit trail | Cannot open Evidentiary Labor Score Audit Trail | P |

## B. Employer (`employer@acme.com`)

| ID | Flow | Expected | Result |
|---|---|---|---|
| B1 | Dashboard | KPI cards, Day 150/165/178 alerts, pipeline | P |
| B2 | Onboard employee | Auto Day 180 computed; appears in directory | – |
| B3 | KPI Configuration (`/rubrics`) | Edit target (≥4.0)+weight; **Apply template**; **Reset to defaults**; weight total badge | P |
| B4 | Weekly rating | Submit ratings across 5 competencies | – |
| B5 | Rollups | Generate monthly Gemini summary; dispatch | P (dispatch) / – (generate) |
| B6 | Training plan | Approve / reject a pending plan | – |
| B7 | **Regularize** (Ana Urgent) | Hero shows **Final record** (not critical window); Recommendation shows **decision** ("Regularized"), AI demoted to "generated before this decision"; no Generate button | P |
| B8 | **Terminate** | Reason is required; reason displayed as "Non-regularization reason" | – |
| B9 | Export report | DOLE print/HTML report opens with all scores + rationale | P (control present) |
| B10 | Audit trail | Immutable entries; no edit/delete affordance | – |
| B11 | Settings | Theme switch (Light/Dark/System), org rename | – |

## C. Supervisor (`supervisor@acme.com`)

| ID | Flow | Expected | Result |
|---|---|---|---|
| C1 | Dashboard | Scoped to assigned direct reports only (2 reports) | P |
| C2 | Weekly rating + remarks | Saved; remarks appear on the employee record | – |
| C3 | KPI Rubrics (`/rubrics`) | Read-only (no edit controls) | P |
| C4 | RBAC | Cannot see employees not assigned to them (403 on Ana) | P |
| C5 | RBAC | No regularize/terminate controls; recommendation copy read-only | P |

## D. Probationary Employee (`emp1`, `emp2`, `emp4`)

| ID | Flow | Expected | Result |
|---|---|---|---|
| D1 | Dashboard | 180-day countdown, scorecard, month-by-month, checklist | P |
| D2 | Acknowledge standards | Recorded; date shown | – |
| D3 | Monthly summaries | Gemini `performance_summary` text shown; **Acknowledge** works | P |
| D4 | Supervisor remarks | Weekly narrative visible | P |
| D5 | Training plans | Assigned plans listed | – |
| D6 | RBAC | Self-scoped only; no directory/admin/other employees | P |
| D7 | **Ana Urgent terminal** | Own view reflects final decision, not a stale AI verdict | P |

## E. Terminal-state regression (bug fixed this cycle)

| ID | Flow | Expected | Result |
|---|---|---|---|
| E1 | Regularized employee record | Hero: "Final record"; Recommendation: decision authoritative; AI output labelled pre-decision; no Regenerate | P |
| E2 | Terminated employee record | Reason shown; recommendation demoted | – |
| E3 | Directory / rollups | Terminal status reflected (Regularized/Terminated) | – |

## F. Cross-cutting invariants

| ID | Check | Expected | Result |
|---|---|---|---|
| F1 | All business dates | `Asia/Manila` — no UTC drift in day counts | – |
| F2 | Explainability visible | "Random Forest", "Feature Importance", "Gemini Performance Rationale" present | P |
| F3 | No fake data | Every value from API; empty/loading states where missing | – |
| F4 | RBAC server-side | Direct API calls outside role return 403 (not just hidden UI) | P |
| F5 | Design system | Role selection uses one accent token; keyboard focus visible; AA contrast | P (accent unified) |

---

## Pass 1 — 2026-10-11 (OpenCode / DeepSeek)

**Accounts covered:** admin, employer, supervisor, emp1, emp2, emp4.

**Findings & fixes.**

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | A **regularized** employee's record still showed the pre-decision AI verdict ("Do Not Regularize") and the hero read "186 / 180 · Critical 48h window" — the human decision was not reflected. | **Fixed** (`EmployeeDetail.jsx`) |
| 2 | Low | "Assigned System Role" radios used a different selected colour per role (employer=accent, supervisor=green, employee=grey). | **Fixed** (all → accent) |
| 3 | Low | Industry template option renders as "Bpo" (should be "BPO"). `prettyTemplate()` only capitalises the first letter. | Open |
| 4 | Observation | Playwright clicks repeatedly timed out ("performing click action") on otherwise-interactive buttons. | **Resolved — tool artifact** (see audit below) |
| 5 | By design | A probationary employee can open `/employees` and sees only their own row (self-scoped, not in nav). | Confirmed |
| 6 | Low | Ana's own dashboard "Month by month" still marked "You are here" at Month 5 (Day 186), and the record's "Probation timeline" read "0 days remaining". | **Fixed** (`EmployeeDashboard.jsx`, `EmployeeDetail.jsx`) |

**Commands used:** Playwright browser driver against the live dev stack.

### Animation / reduced-motion audit (finding #4)

- Enumerated running animations with `document.getAnimations()`. The **only** infinite
  animation in the app is the decorative "live" dot beside the Manila clock
  (`Sidebar.jsx:103`, `animate-pulse`). Critical `MilestonePill` badges also pulse.
- Both are already neutralised for sensitive users by the global rules in
  `index.css:801-821`: `@media (prefers-reduced-motion: reduce)` and
  `html[data-reduce-motion='true']` force `animation-duration: 0.001ms` and
  `animation-iteration-count: 1` on every element. **No infinite animation escapes
  reduced motion.**
- The repeated Playwright click timeouts are a **tool artifact, not an app defect**:
  the report shows the element reaching "visible, enabled and stable" and then hanging
  at "performing click action"; the **login page has zero animations** (`getAnimations()`
  returned `[]`) yet its buttons timed out too. Native DOM clicks and `browser_type`
  succeeded. No code change made.

---

## Results log

| Cycle | Date | Accounts covered | Failures | Fixed |
|---|---|---|---|---|
| 1 | 2026-10-11 | admin, employer, supervisor, emp1, emp2, emp4 | 2 (High: stale verdict; Low: role colours) | 2 |

---

## Gap closure — 2026-10-11

Closing the gaps surfaced after Pass 1.

| # | Gap | Status |
|---|---|---|
| 3 | Audit hash-chain verification was backend-only | **Closed** — "Verify integrity" control on the employee record shows a *Chain verified · N* / *Chain broken* chip (`GET …/audit-trail/verify`). |
| 4 | Admin System Settings not wired | **Closed** — read-only Admin **System settings** section in `/settings` (statutory deadline thresholds + industry KPI template library). |
| 2 | No employer Reports screen | **Closed (partial)** — new `/reports` report center: pick employee + report type → generate/open. The manuscript's persisted "generated reports list" (title/date/size) is **not** built (no Reports model). |
| 1 | Report export is HTML, not PDF | **Open (decision)** — print-to-PDF only; a real `.pdf` file requires a generator dependency. |
| 5 | `/admin/reports/overview` amended-scope conflict | **Open (decision)** — endpoint returns aggregate performance/intervention data the amended scope bars from Admin. |
| 6 | `week_number` unshown; terminal regenerate | **Open (low)** — the backend regenerate-on-terminal guard is a behavior change (STOP-AND-ASK). |

