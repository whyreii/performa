# PERFORMA CAPSTONE IMMUTABLE DIRECTIVES FOR AI AGENTS

This repository houses the **Performa** Capstone Platform — an AI-assisted compliance and decision support platform adhering strictly to **Philippine Labor Code Article 296**.

All AI agents (Antigravity/Gemini, OpenCode/DeepSeek, etc.) operating on this codebase must follow these mandatory rules:

---

## 1. Domain & Legal Invariants (Philippine Labor Code Article 296)
1. **Timezone**: All date computations and evaluations MUST use `Asia/Manila` (UTC+8).
   - Frontend: Use `src/utils/datetime.js`. NEVER call `new Date().toISOString()` for business dates.
   - Backend: Use `backend.timeutils.manila_today()`.
2. **Statutory Benchmark**: The regularizing standard is strictly **4.0 / 5.0** across all 5 core competencies. Do not modify or treat this as an arbitrary config.
3. **Statutory Milestones**: Days 150 (Performance Review), 165 (15-Day Written Notice Buffer), and 178 (Critical 48h to Auto-Regularization).
4. **Explainable AI (XAI)**: References to "Random Forest", "Feature Importance", and "Gemini Performance Rationale" MUST remain transparent for thesis defense criteria. Never delete or hide them as "jargon".
5. **Dual Audit Separation**:
   - `/audits` is the Evidentiary Labor Score Audit Trail (immutable, DOLE/NLRC defense).
   - `/admin/activity` is the IT Sysadmin Security Activity Log.
   - Keep both separate.

---

## 2. Technical Invariants
1. **AI Model**: Primary model is strictly `gemini-3.5-flash-lite` (with `gemini-flash-latest` runtime API fallback). Never downgrade the primary model to 2.5 or 1.5.
2. **Database**: Local development defaults to SQLite (`sqlite+aiosqlite:///./performa.db`). Production/staging supports PostgreSQL via `DATABASE_URL` override.
3. **JavaScript String Replacements**: Never use `.replace('_', ' ')`; always use global regex `.replace(/_/g, ' ')` or `.replaceAll('_', ' ')`.
4. **Design System & Tokens**: Consistently use `src/tokens.css` (the 5 curated themes). Adhere to WCAG 2.1 Level AA for color contrast and keyboard navigation.

---

## 3. Strict Manuscript RBAC Boundaries
1. **System Administrator (`admin@acme.com`)**: Manages user accounts and platform operations (`/admin/*`, `/settings`, `/notifications`). Admins MUST NOT have access to employee performance scorecards, evaluations, or regularization/termination actions.
2. **Employer (`employer@acme.com`)**: Full operational oversight over employee performance, weekly ratings, monthly rollups, and exclusive regularization sign-offs.
3. **Supervisor (`supervisor@acme.com`)**: Weekly ratings and scorecards for assigned direct reports only.
4. **Probationary Employee (`emp1@acme.com`)**: Self-scoped personal dashboard, notifications, and monthly summary digital acknowledgments.

---

## 4. Verification Protocol
Before finishing any task:
1. Run `cd frontend && npm run build` (must build with 0 errors).
2. Run `python -m pytest backend/tests/ -q` (all test suites in `backend/tests/` must pass with 0 errors).
