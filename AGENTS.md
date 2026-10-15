# AGENTS.md: Performa

Rules for every AI agent working in this repo (Antigravity/Gemini, OpenCode/DeepSeek, Claude, any other).
Read this file and `ARCHITECTURE.md` fully before touching code.

Division of labor: `ARCHITECTURE.md` defines the facts and values (competencies, milestone days, the 4.0 standard, model IDs, pipeline, audit logs). This file defines the rules about them and how to work. Each value lives in one place only. If you find a value stated differently in two places, report it.

Why this matters: Performa is a capstone defended before a panel, and its 180-day logic is a legal cutoff. A confident wrong answer costs hours to find. A flagged gap, an "I'm not sure", or a question is always better than a guess.

If requirements conflict, priority is: invariants (§1) > RBAC and data integrity > zero breaking changes > the task as written > style.

---

## 1. Invariants

Never change, remove, weaken, or "improve" these. If a task requires it, stop and ask.

### Domain and legal
1. **Timezone**: all business dates use `Asia/Manila` (UTC+8).
   - Backend: `backend/timeutils.py` (`manila_today()`).
   - Frontend: `src/utils/datetime.js`.
   - Never use `new Date().toISOString()`, naive `datetime.now()`, or `datetime.utcnow()` for business logic.
2. **Timeline and standard**: the 180-day cap, the Day 150 / 165 / 178 milestones, and the 4.0 / 5.0 regularizing standard are defined in `ARCHITECTURE.md` §2. They are fixed constants: not settings, not config. Reference each from one place in code; if you find them duplicated as literals, report it, don't refactor unasked. Use the shared date helpers; never re-implement day math inline. Day-count convention and how the standard is evaluated: `ARCHITECTURE.md` §6a (resolved).
3. **Competencies**: exactly the 5 in `ARCHITECTURE.md` §2. Never add, remove, rename, or re-key one. Attendance stays an evaluator rating score only: no biometrics, punch clocks, or leave requests. Employer-defined **custom KPIs** exist as a separate, non-statutory layer (`custom_kpis`); never fold one into `CompetencyEnum`, the ML feature vector, the 4.0 standard, the competency audit chain, or the catalog mapping.
4. **Explainable AI**: "Random Forest", "Feature Importance", and "Gemini Performance Rationale" stay visible in the UI (needed for thesis defense). Never strip them as "jargon".
5. **Dual audit separation**: the two logs in `ARCHITECTURE.md` §5 stay separate. Never merge or remove either. The Evidentiary Labor Score Audit Trail is immutable (DOLE/NLRC defense).

### Technical
6. **Gemini models**: the model IDs in `ARCHITECTURE.md` §1 are fixed and set in `backend/gemini.py` only. Never downgrade the primary (2.5, 1.5, legacy). If the API rejects a model ID, report the exact error; do not swap IDs. Do not change the temperature unasked (`ARCHITECTURE.md` §6a).
7. **Database**: local default is SQLite (`sqlite+aiosqlite:///./performa.db`); production/staging is PostgreSQL via `DATABASE_URL`. Shared code must run on both. Flag any dialect-specific feature. SQLite drops tzinfo, so always store and convert datetimes through `timeutils`.
8. **JS string replace**: never `.replace('_', ' ')`. Use `.replace(/_/g, ' ')` or `.replaceAll('_', ' ')`.
9. **Design system**: follow `src/tokens.css` (2 curated themes — `paper` light + `graphite` dark (black/white) — plus a Light/Dark/System mode toggle) and WCAG 2.1 AA (contrast, keyboard nav). Before adding a CSS class, search for an existing one. Never define the same class twice. Never use `!important` to override your own earlier CSS. **The "gallery wall" — the single max-width + padding — lives only in `AppShell.jsx`; every page renders through `<Page>` and must never escape it** (no `main:has(...)` full-bleed overrides in `index.css`). **Simple by default**: few, clear elements over feature density; the primary action must be obvious, with no hidden interaction models — if a user would need a hint, simplify it. Enforced by `backend/tests/guardrails/test_page_wrapper.py`.
10. **No fake data**: every number, stat, date, or status shown in the UI comes from the API/DB. No hardcoded demo values in components. If data is missing, render an empty or loading state.

The pipeline rules in `ARCHITECTURE.md` §4-5 (Gemini scope, human approval, audit writes) are equally binding.

---

## 2. RBAC

Enforced server-side on every endpoint. Hiding something in the UI is not access control.

- **System Administrator** (`admin@acme.com`): system/IT-level access for platform oversight (Manuscript Scope of the Study). Own routes: `/admin/*`, `/settings`, `/notifications`.
  - MAY: manage user accounts (create/deactivate/reset); view KPIs system-wide (view-only, via `/admin/reports/overview`); manage global system settings (deadline thresholds, KPI template library); view the system-wide IT activity log (`/admin/activity`).
  - MUST NOT: view probationary employee records, scorecards, evaluations, interventions, or the Evidentiary Labor Score Audit Trail; add/edit employee records; create/edit KPI definitions; enter ratings; or take regularization/termination actions.
- **Employer** (`employer@acme.com`): full operational oversight of employee performance, weekly ratings, and monthly rollups. Exclusive regularization/termination sign-offs and intervention approvals.
- **Supervisor** (`supervisor@acme.com`): weekly ratings and scorecards for assigned direct reports only.
- **Probationary Employee** (`emp1@acme.com`): self-scoped dashboard, notifications, and digital acknowledgment of monthly summaries.

**RESOLVED (Admin)**: Admin has **no access** to probationary-employee performance data (Manuscript Scope of the Study, as amended by the owner). Employee records, scorecards, evaluations, interventions, and the Evidentiary Labor Score Audit Trail are Employer/Supervisor/Employee only. Admin is limited to system/IT oversight (`/admin/*`, `/settings`, `/notifications`); the KPI rubric library is Employer/Supervisor only. Enforced in `backend/tests/test_rbac.py` and `backend/tests/guardrails/test_rbac_matrix.py`; see `ARCHITECTURE.md` §6a-3.

---

## 3. How to work

**Phase 0, Ground.** Read every file the task touches plus its imports, models, and routers. Before writing or changing tests, view `backend/schemas.py` and `backend/models.py`; never guess field names. Record the ACTUAL exported names (e.g. `AsyncSessionLocal` vs `async_session_maker`), column types and nullability, relationships, and constraints. Output a discrepancy list (task says vs code has) BEFORE writing code.

**Phase 1, Classify each gap.**
- SAFE-ADDITIVE (proceed and report): missing import alias, new nullable column, a missing model the task clearly needs, new index or helper.
- STOP-AND-ASK (do not implement that part; implement the rest): the task requires changing or violating an invariant; touches audit schema/immutability, auth/roles, or tenancy scoping in a way the code doesn't already define; destructive schema change (drop/rename/type change); changes behavior of a passing route or test; depends on an open item in `ARCHITECTURE.md` §6.
- Running unattended and can't ask? Implement the safe parts, skip the stop-and-ask parts, and list them first in your report.
- Work that stays within the invariants is normal. It is not a reason to stop.

**Phase 2, Plan.** 2-3 lines: what changes, and what in THIS code could break it (specific null, type, timezone, or edge cases only; no generic lists).

**Phase 3, Implement.**
- Smallest change that solves the problem. Change nothing unrelated. No new dependencies without asking.
- Zero breaking changes: don't remove columns, alter passing routes, or bypass multi-tenancy. Every query touching tenant data is tenant-scoped.
- `Base.metadata.create_all` creates missing tables only; it never alters existing ones. Every schema change needs an explicit migration statement in the report.
- If you return code in chat instead of editing files, return full file replacements, not snippets or diffs.

**Phase 4, Verify.**
1. `cd frontend && npm run build` must finish with 0 errors.
2. `python -m pytest backend/tests/ -q` must pass with 0 errors.
- Do not edit tests or loosen assertions to make them pass.
- Never claim something passes unless you ran it and can show the output. If you couldn't run it, say so.

---

## 4. Debugging

- Quote the exact line(s) or error text that point at the root cause. Fix the cause: no blanket try/except, no loosened types, no deleted checks, no suppressed errors.
- If I say your fix failed: re-read the code and error first, then decide. If I'm wrong, show evidence. If you're wrong, state what was wrong in your earlier reasoning. Don't agree or defend by reflex.
- After two failed attempts, stop patching. List your assumptions, name the one most likely wrong, and ask for the info that would test it.
- If you're unsure a library API exists or behaves the way you're using it, mark it UNVERIFIED and say what to check.
- Don't invent identifiers (tables, columns, routes, functions, library methods). Use only what you read in the code or are certain exists.

---

## 5. Final report

Include only the sections that apply. Keep it short for small tasks.
1. Files changed
2. Discrepancies reconciled (task said / code had / what you did)
3. STOP-AND-ASK items not implemented, with the exact info needed
4. Assumptions
5. UNVERIFIED items
6. Migration statements
7. How to test: exact commands and expected result

---

## 6. Guardrail tests

The invariants in §1 and the facts in `ARCHITECTURE.md` are enforced by tests and lint, not just prose:

- **Tests**: `backend/tests/guardrails/` (competencies, RBAC matrix, audit, time, Gemini scope, human-in-the-loop, ML order, docs consistency, snapshot).
- **Backend lint**: `python -m ruff check backend` (flake8-datetimez `DTZ` — no naive `datetime.now()`/`datetime.utcnow()` in business code). Config: `ruff.toml`.
- **Frontend lint**: `cd frontend && npm run lint` (no `.toISOString()` outside `src/utils/datetime.js`; no `.replace('_', ' ')`; no arbitrary `text-[…px]`; no `shadow-sm` on `rounded-float` cards; no `uppercase` kickers on `span`/`div`). Config: `frontend/eslint.config.js`.

Rules:
- Never edit, skip, weaken, or delete a guardrail test to get a pass.
- A failing guardrail test means the code is wrong — unless the owner first changed the invariant in the docs. If a test exposes a real violation, mark it `xfail(strict=True)` with a reason and report it; do not silently fix the invariant.
- Anything depending on an open item in `ARCHITECTURE.md` §6a/§6b must be `skip`ped with `pending decision: <item>`, never asserted as a guess.

---

## 7. Output style

How to present work. The owner reads these responses directly; keep them tight and evidence-first.

- **Lead with the outcome, then the evidence.** No preamble, no restating the task, no "I will now…".
- Use a **compact table or short bullet list** for anything with more than ~2 items; reserve prose for reasoning.
- Every implementation report, in order: **what changed → verified live → gates → flagged**.
  - **Verified live** means an actual measurement (DOM/`getBoundingClientRect`/computed style/API response) — a screenshot alone is not proof.
  - **Gates** = `cd frontend && npm run build` · `npm run lint` · `npx vitest run` · `python -m pytest backend/tests/ -q`.
- **State the commit hash** when you ship, and keep each commit scoped to its change.
- If you edited a test on purpose (an intentional design change), say so explicitly and why.
- Never claim something passes unless you ran it and can show the output. If you couldn't run it, say so plainly.
- When the task is ambiguous, or a value appears differently in two places, **ask or flag it** — never guess.

### Model and variant by task type (OpenCode)

| Task type | Model | Variant |
|---|---|---|
| Routine: UI tweaks, test fixes, docs, copy | `claude-haiku-5-5` | `low` (`none` for trivial edits) |
| Hard: migrations, RBAC, audit chain, ML or Gemini pipeline | `claude-haiku-5-5` | `high` |
| Second opinion on a hard diff | `deepseek-v4.1-flash` | `high` |
| Stuck after a `high` attempt | `claude-haiku-5-5` | `xhigh` (then `max` only if still stuck) |

Starting points, not yet measured. Revise after the bake-off.

### UI foundation (current, keep it)
The design grammar the app settled on lives in `docs/LAYOUT_GRAMMAR.md` and `src/tokens.css`:
- **Flat sections**, not boxes: `SectionHead` + hairline rows. Use `Card` only when a block genuinely needs a surface.
- **`StatBand`** for top stat strips (dashboard, admin, scorecard, rate). **`PageGrid`/`Row`/`Col`** for columns.
- The **toolbar carries the single page title**; do not add a second title block in the body.
- One source per value: `config/domain` (competencies, target, milestones), `utils/status` (tones/labels), `utils/datetime` (Asia/Manila).
