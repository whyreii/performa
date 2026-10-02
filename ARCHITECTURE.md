# ARCHITECTURE DIRECTIVES: PERFORMA

## 1. Technical Stack
- Frontend: React 18 (Vite SPA), Tailwind CSS, Lucide React icons, TanStack Query.
- Backend: Python 3.10+, FastAPI (async endpoints), SQLAlchemy 2.0 (asyncpg), Pydantic v2.
- Database: PostgreSQL (tables initialized via Base.metadata.create_all on startup).
- ML & GenAI: scikit-learn (Random Forest loaded in-memory), Google Gemini API (async, temp 0.0).
- Auth: JWT Bearer tokens enforcing 4 distinct roles: admin, employer, supervisor, probationary_employee.

## 2. Legal Constraints (Philippine Labor Code Article 296)
- Timeline Cap: Strict 180 calendar days computed in Asia/Manila timezone.
- Statutory Milestones: Automated alerts triggered at Day 150, Day 165, and Day 178.
- 5 Competency Categories Only:
  1. task_completion
  2. attendance_and_punctuality (evaluator rating score only; no biometric punch clocks or leave requests)
  3. communication_and_teamwork
  4. initiative_and_adaptability
  5. quality_of_work

## 3. Intervention & Decision Pipeline
- Weekly scores roll up into monthly averages across the 5 competencies.
- Random Forest classifies competency status: Meets Expectations, Needs Improvement, or Critical Gap.
- Deficiencies (Needs Improvement, Critical Gap) map deterministically to backend/ml/training_catalog.json.
- The Gemini API generates ONLY:
  - A 2-sentence performance summary.
  - A 1-sentence rationale per catalog intervention.
- Fallback: If Gemini times out, catalog items are saved with empty rationales.
- Human-in-the-Loop: Interventions remain pending_approval until an Employer explicitly signs off.
- Audit Trail: Any score update writes an immutable audit record containing evaluator ID, employee ID, prior score, new score, and timestamp.

## Agent Pre-Execution Audit & Gap Protocol
1. Source of Truth First: Read all referenced files before writing code. Verify actual exported names, variable naming (e.g., AsyncSessionLocal vs. async_session_maker), and database constraints.
2. Gap Handling & Alignment: If a prompt references a model, column, relationship, or import that does not exist or conflicts with current code:
   - Do NOT fail silently or blindly assume the prompt is 100% correct.
   - Apply necessary additive modifications (e.g., declare missing models, make restrictive columns nullable if business logic requires it, add clean aliases) without breaking existing functionality.
   - List every discrepancy, gap, or assumption you reconciled in your final report.
3. Zero Breaking Changes: Do not remove existing columns, alter passing routes, or bypass multi-tenancy rules.