# ARCHITECTURE.md: Performa

What the system is, and the single source of truth for its values (model IDs, competency IDs, milestone days, the 4.0 standard). Rules about these values, RBAC, and how to work live in `AGENTS.md`. If a rule here conflicts with `AGENTS.md`, `AGENTS.md` wins and you report it.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 (Vite SPA), Tailwind CSS, Phosphor Icons, TanStack Query. Design tokens in `src/tokens.css` |
| Backend | Python 3.10+, FastAPI (async endpoints), SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | SQLite (`aiosqlite`) for local dev; PostgreSQL (`asyncpg`) for production/staging via `DATABASE_URL` |
| Schema creation | `Base.metadata.create_all` on startup. Creates missing tables only; never alters existing ones |
| ML | scikit-learn Random Forest, loaded in memory |
| GenAI | Google Gemini API, async, temperature 0.0. Primary `gemini-3.5-flash`, fallback `gemini-3.1-flash-lite`, configured in `backend/gemini.py` |
| Auth | JWT Bearer tokens, 4 roles: `admin`, `employer`, `supervisor`, `probationary_employee` |

---

## 2. Domain values (Philippine Labor Code Art. 296, per the manuscript)

- **Probation cap**: 180 calendar days from the start date, computed in `Asia/Manila`.
- **Review milestones**: Day 150 (Performance Appraisal), Day 165 (15-Day Written Notice Buffer), Day 178 (Critical 48h to Auto-Regularization). Each triggers an automated alert.
- **Regularizing standard**: 4.0 / 5.0 across the 5 core competencies.
- **Competencies (exactly 5)**:

| Identifier | Notes |
|---|---|
| `task_completion` | |
| `attendance_and_punctuality` | Evaluator rating score only. No biometric punch clocks, no leave requests |
| `communication_and_teamwork` | |
| `initiative_and_adaptability` | |
| `quality_of_work` | |

- **Competency status** (classifier output; the Random Forest is a learned *surrogate* that reproduces and explains it): Meets Expectations, Needs Improvement, Critical Gap.
- **Custom KPIs (employer-defined, non-statutory)**: an Employer may define named KPIs outside the five
  (`custom_kpis` table, `backend/routers/custom_kpis.py`). They are rated weekly and never enter the 4.0
  standard, the Random Forest feature vector, the competency audit chain, or the five-item catalog mapping.
  When a custom KPI is mapped to a catalog course and its monthly average is below 3.0, that course is
  raised deterministically for employer approval; Gemini only names it.

---

## 3. Roles and tenancy

- Four roles (permission matrix in `AGENTS.md` §2). JWT Bearer on every protected endpoint; role and tenant checks happen server-side.
- The Admin manages tenant operations, so every query touching tenant data must be tenant-scoped. The tenant key and scoping mechanism are read from the code (§6c).

---

## 4. Intervention and decision pipeline

1. **Weekly ratings** per competency, entered by the Employer, or by a Supervisor for assigned direct reports only.
2. **Monthly rollup**: weekly scores average into one score per competency per month.
3. **Classification**: a learned **Random Forest surrogate** reproduces the deterministic Article 296 competency cascade. It emits one employee-level tier (Meets Expectations / Needs Improvement / Critical Gap); any competency scoring below 3.0 is separately flagged as a gap. The cascade is the authoritative classifier (legal determinism); the forest is a surrogate so that exact Shapley and permutation explanations can be computed over it (see `docs/XAI_METHODOLOGY.md`).
4. **Catalog mapping**: Needs Improvement and Critical Gap map deterministically to `backend/ml/training_catalog.json`. No model decides which interventions apply.
5. **Gemini generates ONLY**:
   - a 2-sentence performance summary, and
   - a 1-sentence rationale per catalog intervention.
   Gemini never selects, adds, removes, or reorders interventions.
6. **Fallback**: if Gemini times out, catalog items are saved with empty rationales. Saving is never blocked by Gemini.
7. **Human in the loop**: interventions stay `pending_approval` until an Employer explicitly signs off.
8. **Custom KPIs**: employer-defined KPIs are averaged monthly alongside the competencies but stay outside the 4.0 standard. When a mapped custom KPI's monthly average is below 3.0, its catalog course joins the deterministic set; Gemini only names it (never selects it). The mapping is chosen and stored when the Employer defines the KPI.

---

## 5. Audit

Two separate logs. Never merge or remove either.

- **`/audits`: Evidentiary Labor Score Audit Trail.** Any score update writes an immutable record: evaluator ID, employee ID, prior score, new score, timestamp.
- **`/admin/activity`: IT System Activity Log.** Security and system activity for the Admin.

---

## 6. Open items

Agents: do not guess on anything in this section.

### 6a. Owner decisions (RESOLVED)

1. **Day-count convention**: the start date is **Day 0**; `days_elapsed = (manila_today() - start_date).days`.
   **Day 180** is the statutory cap (`day_180_date = start_date + 180`) and is still a valid probation day.
2. **The 4.0 standard**: the **capstone's immutable regularizing benchmark** — a hard floor of **4.0 / 5.0
   across all 5 competencies** (`default=4.0, ge=4.0, le=5.0` in `backend/schemas.py`). Employers may set
   **higher** targets (e.g. 4.5) but never lower.
3. **Admin access to performance data**: **none** (Manuscript Scope of the Study, as amended). Admin has no
   access to probationary-employee records, scorecards, evaluations, interventions, or the Evidentiary
   Labor Score Audit Trail; those are Employer/Supervisor/Employee only. Admin retains system/IT oversight
   (`/admin/*`, `/settings`, `/notifications`); the KPI rubric library is Employer/Supervisor only. Enforced in
   `backend/tests/test_rbac.py` and `backend/tests/guardrails/test_rbac_matrix.py`; see `AGENTS.md` §2.
4. **Deadline thresholds**: **Days 150, 165, and 178 are fixed statutory Article 296 milestones** and are
   **not configurable**. `GET /api/admin/settings` (`backend/routers/admin.py`) exposes `DEADLINE_THRESHOLDS`
   to the Admin for **oversight only** (non-configurable cutoffs).
5. **KPIs vs competencies**: exactly the **5 statutory competencies**. "KPI configuration" = setting the
   **weight** and **target (≥ 4.0)** for those 5, plus industry **template presets** (`docs/DECISIONS.md` J2).
   Arbitrary per-role KPIs are out of scope.
6. **Score corrections / audit**: any score change appends an **immutable** `EvaluationAuditLog` record
   (one per changed competency; no edit/delete path); monthly rollups **lock (HTTP 409)** once dispatched
   or acknowledged.

**Still open (owner to confirm):**

7. **Leftover code from earlier stack iterations**: list paths, or "none".
8. **Gemini temperature**: currently 0.0. Google's docs recommend leaving Gemini 3.x models at the default
   1.0, because lower values can cause looping or degraded output. Keep 0.0, or switch to the default and
   rely on code-side validation and stored outputs for reproducibility? Test on real prompts first. Do not
   change it unasked.

### 6b. Proposed defaults (ask before implementing; marked items are owner-resolved)

1. Audit record also stores competency and period; `prior score` is nullable for a first entry. — **RESOLVED** (owner-confirmed; implemented in `backend/models.py` `EvaluationAuditLog`, tested by `test_audit.py` 6b-1).
2. The audit row is written in the same DB transaction as the score update (both commit or neither). — **RESOLVED** (owner-confirmed; single commit in `backend/routers/evaluations.py:submit_weekly_rating`, tested by 6b-2).
3. No update/delete path for audit rows in app code, plus a DB-level block (permissions or trigger on PostgreSQL). — **RESOLVED** (owner-confirmed; dialect triggers in `backend/audit_immutability.py`, applied on `create_all` and by Alembic `0003_immutable_audit`; tested by 6b-3).
4. Every transition out of `pending_approval` has a server-side Employer role check.
5. Gemini output is validated in code (sentence count, non-empty). Invalid output is treated as a failure: save empty rationales and log it. Evaluator free text is untrusted input to the prompt.
6. Each generated summary records which model answered (primary vs fallback), since `gemini-flash-latest` is a moving alias.

### 6c. Facts to read from the code (report what you found; ask only if the code is ambiguous or contradicts itself)

- Tenant key and scoping mechanism
- Intervention status values beyond `pending_approval`
- Random Forest artifact path, feature column order, label encoding
- How `training_catalog.json` is keyed (competency + status to items)
- Schema change method (Alembic or manual SQL)
- Where the `/audits` and `/admin/activity` records are written

---

## 7. Generated snapshot

`docs/generated/architecture-snapshot.md` is generated from the code (schema, routes, environment variables, key paths) — never hand-edit it. Regenerate with:

```
python scripts/gen_architecture_snapshot.py
```

`backend/tests/guardrails/test_snapshot.py` fails if the committed snapshot is stale.
