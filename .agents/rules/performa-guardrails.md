# Performa: Always-On Rule

Canonical rules live in `AGENTS.md`; canonical values live in `ARCHITECTURE.md`. Before any task, read both fully, including the open items in `ARCHITECTURE.md` §6. If this file disagrees with either, they win and you report the disagreement.

Tripwires (summary only, no values). Stop and ask before breaking any of these:
1. Business dates go through the Asia/Manila helpers (`AGENTS.md` §1.1). Never `toISOString()`, naive `datetime.now()`, or `datetime.utcnow()` for business logic.
2. Do not change the competency set, the 180-day cap, the milestone days, or the 4.0 standard (`ARCHITECTURE.md` §2).
3. Gemini writes ONLY the summary and the per-intervention rationale; catalog mapping is deterministic; interventions stay `pending_approval` until an Employer signs off (`ARCHITECTURE.md` §4).
4. Every score update writes an immutable audit record, and the two logs stay separate (`ARCHITECTURE.md` §5).
5. Do not change Gemini model IDs or temperature to dodge an error; report it (`ARCHITECTURE.md` §1, §6a).
6. RBAC is enforced server-side. Admin has **no access** to probationary-employee performance data (`AGENTS.md` §2, `ARCHITECTURE.md` §6a-3): do not add it back.
7. Never guess field names: view `backend/schemas.py` and `backend/models.py` first. Verify with `cd frontend && npm run build` and `python -m pytest backend/tests/ -q`. Never claim a pass you did not run.
