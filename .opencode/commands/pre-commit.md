---
description: Audit the working/staged diff against Performa invariants before committing (raw hex, non-global replace, statutory math, timezone, RBAC).
---

Audit the current changes against Performa's immutable invariants (see AGENTS.md).
Read-only: inspect with git/read/grep only — never edit.

1. Review `git diff` and `git diff --staged` for every changed file.
2. Flag violations:
   - Raw `#hex` colors in `frontend/src/**` — styling must use tokens from `src/tokens.css`.
   - Non-global `String.replace('_', ' ')` in JS/JSX — must use `.replace(/_/g, ' ')` or `.replaceAll('_', ' ')`.
   - Any change to Article 296 math: Day 0 = start, milestones 150 / 165 / 178, 180-day cap, or the 4.0/5.0 benchmark.
   - Business dates built with `new Date().toISOString()` (must use `src/utils/datetime.js` on the frontend, `backend.timeutils.manila_today()` on the backend).
   - RBAC: writes that must stay Employer-only (employee create/edit/status, KPI definitions, monthly rollups, dispatch, sign-off, regularization).
   - Dual-audit separation: `/audits` (evidentiary) must stay distinct from `/admin/activity` (sysadmin).
3. Output a table:

| File | Line | Violation | Severity | Suggested fix |
|------|------|-----------|----------|---------------|

4. End with a single verdict: **BLOCK** (invariant violated) or **SAFE TO COMMIT**.
