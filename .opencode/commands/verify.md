---
description: Run the full verification protocol (frontend build, backend tests, git status) and report a clean pass/fail table.
---

Run Performa's verification protocol and report a clean pass/fail summary.
Do not modify any files - this command is read-only.

Steps:

1. Frontend build - run `npm run build` with the working directory set to `frontend/`
   (do NOT use `cd frontend && ...`; this shell is Windows PowerShell 5.1, which does
   not support `&&`). Must finish with 0 errors.
2. Backend tests - `python -m pytest backend/tests/ -q` (all suites must pass).
3. Working tree - `git status --short` (report uncommitted changes).

Then output exactly this Markdown table:

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Frontend build | `npm run build` | PASS/FAIL | error count |
| Backend tests | `python -m pytest backend/tests/ -q` | PASS/FAIL | N passed |
| Working tree | `git status --short` | clean/dirty | file count |

If any check fails, stop and surface the first error verbatim (do not attempt a fix).
