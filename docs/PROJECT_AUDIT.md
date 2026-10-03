# Performa — Full Project Audit (WS1–WS7)

**Date:** 2026-10-03 · **Auditor:** OpenCode (DeepSeek) · **Method:** static review + live browser/API + test suite
**Scope:** WS1 RBAC & tenancy · WS2 Art. 296 domain · WS3 E2E lifecycle · WS4 API contracts · WS5 data integrity · WS6 AI/ML · WS7 tests
**Excluded:** WS10 (UI/UX styling re-audit) per instruction — design tokens/contrast/QOL already hardened.
**Reference:** capstone manuscript *Scope of the Study* (`Documents\manuscript lol\...docx.txt`), `AGENTS.md`.

**Severity:** P0 critical (broken/security) · P1 high (manuscript/legal/security defect) · P2 medium · P3 low.
**Verification snapshot:** `python -m pytest -q` → **34 passed** · `npm run build` → **clean**.

---

## Findings

### WS1 — RBAC & Tenancy

**RBAC-1 (P1) — Admin & Supervisor can generate monthly rollups.**
`POST /api/interventions/{employee_id}/monthly-rollup` allows `ADMIN, EMPLOYER, SUPERVISOR` (`backend/routers/interventions.py:130-132`).
Manuscript: rollup/summary generation is an **Employer** function; Supervisor is *view-only* for training recommendations, Admin is *view-only* for reports.
**Live probe** (non-existent ID → status distinguishes authz): `admin=404`, `employer=404`, `supervisor=404` → all three pass authz.

**RBAC-2 (P1) — Admin can dispatch monthly summaries.**
`POST /api/interventions/summaries/{summary_id}/dispatch` allows `ADMIN, EMPLOYER` (`interventions.py:352`).
Manuscript: "Employee Acknowledgement Dispatch" is **Employer**-only.
**Live probe:** `admin=404` (allowed), `supervisor=403` (correctly denied).

**RBAC-3 (P1) — Admin can sign off training interventions.**
`POST /api/interventions/{plan_id}/sign-off` allows `ADMIN, EMPLOYER` (`interventions.py:499`).
Manuscript: human-in-the-loop sign-off is **Employer**-exclusive.
**Live probe:** `admin=404` (allowed), `supervisor=403`.

**RBAC-4 (P1) — Supervisor can generate regularization recommendations.**
`POST /api/evaluations/{employee_id}/regularization-recommendation` allows `EMPLOYER, SUPERVISOR` (`evaluations.py:370`).
Manuscript: Supervisor is **view-only** on regularization ("does not hold decision-making authority").
**Live probe:** `supervisor=404` (allowed), `admin=403` (correctly denied).

**RBAC-5 (P3) — Admin on view-only helper endpoints (acceptable, noted).**
`GET /api/employees/supervisors` allows `ADMIN` (`employees.py:320`); `GET /api/interventions/pending` (`interventions.py:471`) and `GET /api/interventions/summaries` (`:297`) allow `ADMIN`. These are read-only and fall under Admin's manuscript "reports"/oversight scope — low risk.

**Tenancy:** every router except `notifications.py` filters `organization_id`; notifications scope by `user_id` (tenant-safe). `_fetch_employee`/`_get_scoped_employee` enforce tenant + role. **No cross-tenant leak found.**

**Nav ↔ route-guard consistency:** verified all roles — no 403 dead links (Admin `/audits` removed by Gemini; confirmed).

### WS2 — Article 296 Domain Correctness

**DOMAIN-1 (P2) — Day-count convention is internally inconsistent (possible off-by-one).**
The UI labels the start date as **"Day 1 (Start)"** (`frontend/src/pages/employees/EmployeeDetail.jsx` milestone markers) but the math treats the start date as **Day 0**:
- `frontend/src/utils/datetime.js` → `daysElapsed = round((now - start)/86400000)` → `0` on the start date.
- `backend/routers/employees.py:182` → `day_180_date = start_date + 180 days` (i.e., the 181st calendar day if start = Day 1).
Impact: the displayed day number and the statutory deadline can be off by one depending on the legal reading of "Day 1 = first day of employment." **Needs legal confirmation**, then align labels + math.

**Timezone:** clean — no naive `datetime.now()`/`utcnow()`/`date.today()`/`toISOString()` in backend; `manila_today()` used for statutory math; 4 aware `datetime.now(timezone.utc)` timestamps are storage-only and rendered in Manila.

**Immutable audit trail:** `EvaluationAuditLog` is append-only (no update/delete route). ✅

**4.0 benchmark:** anchored (KPI defaults, `config/domain.js`). ✅

### WS5 — Data Integrity

**DATA-1 (P1) — Re-running a rollup destroys prior sign-offs, dispatch, and acknowledgements.**
`monthly_rollup` is "idempotent" by **deleting and recreating** the `MonthlySummary` and its `TrainingPlan`s (`interventions.py:201-238`), discarding `dispatched_at`/`acknowledged_at` and any approved plans.
**Live repro:** rated emp1 → rollup → approved 2 plans → dispatched → employee acknowledged → re-ran rollup → `dispatched_at=null`, `acknowledged_at=null`, pending plans **0 → 2**.
Impact: silently erases **evidentiary records** (DOLE/NLRC) — a legal and audit-trail integrity defect.

**DATA-2 (P2) — Month window boundary overlap.**
`month_start = start + (n-1)*30`, `month_end = start + n*30`, filter `>= month_start AND <= month_end` (`interventions.py:137-147`). Month *n*'s inclusive end equals month *n+1*'s inclusive start, so an evaluation dated exactly on day 30/60/90/120 is counted in **two** months.
**Live repro:** emp1's rating on day 30 (start+30) matched month 1; it also satisfies month 2's window.

**Schema:** FKs present (`models.py`); `users.email` unique; `organizations.name/slug` unique; indexes on key FKs. ✅

### WS3 — End-to-End Lifecycle (live)

**Full pipeline verified working:** supervisor rating → employer rollup (avg 3.32, "Needs Improvement") → 2 pending plans → employer sign-off (`approved`) → dispatch → employee sees summary → employee acknowledgement. **No errors** at any step.
**Gap:** the Rollups UI offers only months **1–5** (`Rollups.jsx`), but an employee can be past day 150 (month 6) — e.g., emp2 (day 152) has no matching month option. Minor (system is scoped to mid-5th month).

### WS4 — API Contracts

Exercised every primary endpoint live across roles; **no shape mismatches observed**. `api.js` methods map to existing backend routes with matching field names (e.g., `overall_score`, `status_classification`, `dispatched_at`, `acknowledged_at`). *Not exhaustively field-checked for every optional field.*

### WS6 — AI/ML Pipeline

Clean. `backend/ml/predictor.py` validates all 5 competencies present/numeric/in `[1.0,5.0]`, returns tier + confidence + probabilities + feature importances + flagged competencies; missing model → 503. `backend/gemini.py` degrades gracefully (no key / timeout / error → fallback) and reads the key at call time. No key leakage.

### WS7 — Tests

`34 passed`. **Coverage gaps:** no tests for RBAC-1…4 (authz over-privilege), DATA-1 (rollup wiping ack/sign-off), DATA-2 (month overlap), or the full E2E lifecycle. Existing tests cover happy paths + some 403s (supervisor scoping, admin-only activity).

---

## Prioritized Fix List

| ID | Sev | Fix | Effort |
|----|-----|-----|--------|
| DATA-1 | P1 | Make rollup regeneration **non-destructive**: upsert the summary/plans and **preserve** `dispatched_at`/`acknowledged_at` + approved plan statuses (or block re-run once dispatched/acknowledged). | M |
| RBAC-1 | P1 | `monthly-rollup` → `require_role(EMPLOYER)`. | S |
| RBAC-2 | P1 | `summaries/{id}/dispatch` → `require_role(EMPLOYER)`. | S |
| RBAC-3 | P1 | `{plan_id}/sign-off` → `require_role(EMPLOYER)`. | S |
| RBAC-4 | P1 | `regularization-recommendation` POST → `require_role(EMPLOYER)`. | S |
| DATA-2 | P2 | Fix month window to be half-open (`>= start_n` and `< start_{n+1}`) or `<= start + n*30 - 1 day`. | S |
| DOMAIN-1 | P2 | Confirm legal day-count convention; align UI labels + `daysElapsed` + `day_180_date` consistently. | M |
| RBAC-5 | P3 | (Optional) trim Admin from `/employees/supervisors`. | S |
| TEST | P2 | Add tests: RBAC-1…4 (403 for Admin/Supervisor), rollup-preserves-ack, month-boundary, E2E lifecycle. | M |
| UX | P3 | Rollups month selector: handle employees past day 150 (or document the mid-5th-month cap). | S |

## Verified clean
- No cross-tenant data leak; FK/unique constraints present.
- No naive-datetime/UTC leaks; Asia/Manila enforced.
- Immutable evaluation audit trail (append-only).
- Gemini fallback + RF input validation robust.
- Full E2E lifecycle works; build + 34 tests pass.
- Nav ↔ route-guard consistency (no dead links).

---

## Remediation status (applied)

| ID | Status | Change |
|----|--------|--------|
| RBAC-1 | ✅ Fixed | `monthly-rollup` → `require_role(EMPLOYER)` (`interventions.py`). |
| RBAC-2 | ✅ Fixed | `summaries/{id}/dispatch` → `require_role(EMPLOYER)`. |
| RBAC-3 | ✅ Fixed | `{plan_id}/sign-off` → `require_role(EMPLOYER)`. |
| RBAC-4 | ✅ Fixed | `regularization-recommendation` POST → `require_role(EMPLOYER)`. |
| DATA-1 | ✅ Fixed | Rollup now updates in place, preserves plan decisions, and returns **409** if the month was already dispatched/acknowledged — no more record wiping. |
| DATA-2 | ✅ Fixed | Month window is now non-overlapping: `[start + (n-1)*30, start + n*30 - 1]`. |
| TEST | ✅ Fixed | Added RBAC + rollup-preservation regression tests; updated month-window tests. Suite: **38 passed**. |
| RBAC-5 | ⏸ Won't-fix | Admin keeps view-only `/employees/supervisors` (per decision). |
| UX (month selector) | ⏸ By design | Months 1–5 only (system scoped to mid-5th month). |
| DOMAIN-1 | ⏳ Pending decision | Day-count convention (Day 1 vs Day 0) needs a legal call before changing statutory math. |

**Live RBAC verification (post-fix):** rollup / dispatch / sign-off / regularization → `admin=403, employer=404, supervisor=403`.
