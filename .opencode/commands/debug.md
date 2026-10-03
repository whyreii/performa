---
description: Run the backend diagnostic sweep — tests, frontend build, DB config + Alembic status — and print a status table.
---

Run Performa's diagnostic sweep. Read-only: do not modify files.

This shell is **Windows PowerShell 5.1** — do NOT use `&&`. Run each command
separately, and for the frontend build set the working directory to `frontend/`
rather than chaining `cd frontend && …`.

Steps:

1. Backend test suite — `python -m pytest backend/tests/ -q` (from the repo root).
2. Frontend build — `npm run build` with the working directory set to `frontend/`.
3. Database configuration — report the effective `DATABASE_URL` (the env override,
   or the SQLite default `sqlite+aiosqlite:///./performa.db`).
4. Migration status — `python -m alembic current` (from the repo root).
5. Environment flags — report whether `PERFORMA_TODAY` and `SQL_ECHO` are set.

Then output exactly this table:

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Backend tests | `python -m pytest backend/tests/ -q` | PASS/FAIL | N passed |
| Frontend build | `npm run build` (cwd `frontend/`) | PASS/FAIL | error count |
| Database | effective `DATABASE_URL` | — | sqlite / postgres |
| Migrations | `python -m alembic current` | — | current revision |
| `PERFORMA_TODAY` | environment | set / unset | value |
| `SQL_ECHO` | environment | set / unset | value |

If any check fails, stop and surface the first error verbatim (do not attempt a fix).
