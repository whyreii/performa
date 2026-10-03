# PERFORMA CAPSTONE IMMUTABLE GUARDRAILS

## 1. Domain & Legal Grounding (Philippine Labor Code Article 296)
- **Timezone**: Strictly `Asia/Manila` (UTC+8). NEVER use `new Date().toISOString()` for business logic; always use `src/utils/datetime.js` (frontend) or `backend/timeutils.py` (backend).
- **Statutory Milestones**: Automated review alerts trigger at Day 150 (Performance Appraisal), Day 165 (15-Day Written Notice Buffer), and Day 178 (Critical 48h to Auto-Regularization).
- **Statutory Benchmark**: The regularizing standard is strictly **4.0 / 5.0** across all 5 core competencies. Do not alter or treat this as an arbitrary setting.
- **Explainable AI (XAI)**: References to "Random Forest", "Feature Importance", and "Gemini Performance Rationale" MUST remain transparent for academic capstone defense evaluation. Never strip them as "jargon".
- **Dual Audit Separation**: The Evidentiary Labor Score Audit Trail (`/audits`) is distinct from the IT System Activity Log (`/admin/activity`). Never merge or eliminate either.

## 2. Technical Invariants
- **AI Model**: Primary model is strictly `gemini-3.5-flash-lite` (with `gemini-flash-latest` runtime API fallback). Never downgrade the primary model to `gemini-2.5-flash` or legacy models in `backend/gemini.py`.
- **Database**: Local development defaults to SQLite (`sqlite+aiosqlite:///./performa.db`). Production/staging supports PostgreSQL via `DATABASE_URL` override.
- **JavaScript String Replacements**: Never use `.replace('_', ' ')`; always use global regex `.replace(/_/g, ' ')` or `.replaceAll('_', ' ')`.
- **Design System & Aesthetics**: Follow `src/tokens.css` (the 5 curated themes). Adhere to WCAG 2.1 Level AA for color contrast and keyboard navigation.

## 3. Strict Manuscript RBAC Boundaries
- **Admin (`admin@acme.com`)**: System Administrator manages user accounts and tenant operations (`/admin/*`, `/settings`, `/notifications`). Admins MUST NOT have access to employee performance scorecards, evaluations, or regularization/termination actions.
- **Employer (`employer@acme.com`)**: Full operational oversight over employee performance, weekly ratings, monthly rollups, and exclusive regularization sign-offs.
- **Supervisor (`supervisor@acme.com`)**: Weekly ratings and scorecards for assigned direct reports only.
- **Probationary Employee (`emp1@acme.com`)**: Self-scoped personal dashboard, notifications, and monthly summary digital acknowledgments.

## 4. Grounding Protocol ("Read Before You Write")
- Always view the target schema (`backend/schemas.py`) and model (`backend/models.py`) before writing or updating tests. Never guess field names.
- Always run `npm run build` and `python -m pytest backend/tests/ -q` to verify changes before marking tasks complete.
