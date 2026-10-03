# Performa — Master Project Roadmap & System Status

> **System Status**: **100% Complete — Full-Stack Live, Tested & Defense-Ready**  
> **Backend**: FastAPI on `http://localhost:8000` (Status: `ONLINE`, 0 errors)  
> **Frontend**: React + Vite on `http://localhost:5173` (Status: `RUNNING`, 0 build errors)  
> **Current Phase**: **Complete — Post-Defense Hardening (see `docs/PROJECT_AUDIT.md`)**

---

## 🧭 Executive Summary: Where We Are Right Now

If you feel lost, here is the quick bird's-eye view:

1. **The Entire System Is Built, Tested, and Working End-to-End.**
   - Both the FastAPI backend and React frontend are actively running.
   - All 5 statutory competencies under Philippine Labor Code Article 296 are wired.
   - All 13 application screens are migrated to the design system, connected to live API endpoints, and working.

2. **Overall Progress: 100%**
   ```
   [████████████████████] 100% Completed
   ```
   - **Phases 1–6 (Backend):** 100% Finished (Database, Legal Engine, Weekly Ratings, ML Classifier, GenAI Rollups, Code Hygiene).
   - **Phases 7A–7F (Frontend):** 100% Finished (Tokens, AppShell, Primitives, all screens, QA & accessibility).
   - **Phase 8 (Testing & Hardening):** Complete — consolidated Pytest suite (`backend/tests/`).
   - **Post-completion:** Full project audit + fixes tracked in `docs/PROJECT_AUDIT.md`.

---

## 🚀 Quick Start: How to Test Everything Live Right Now

Open your browser to: **`http://localhost:5173`**

### Seed Accounts (Password for all: `Password123!`):

| Role | Email | Redirects To | What You Can Test Right Now |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@acme.com` | `/admin/users` | • **User Account Management Module**: Provision accounts & assign roles<br/>• Deactivate/reactivate accounts & reset user passwords<br/>• View-only employee records & KPIs (cannot add/edit per Art. 296)<br/>• System activity log (`/admin/activity`)<br/>• System settings & live 5-palette theme switcher |
| **Employer (Business Owner)** | `employer@acme.com` | `/dashboard` | • Executive KPI metrics & Day 150 urgent banner<br/>• 180-Day Probation timeline & live employee pipeline<br/>• **Exclusive Onboarding**: Add employee with auto Day 180 calculation<br/>• Monthly 30-Day Rollups with Gemini AI summaries<br/>• Employer digital sign-off on training plans<br/>• DOLE-compliant audit trail with printable export view<br/>• Settings: Switch between all 5 theme palettes live |
| **Supervisor** | `supervisor@acme.com` | `/supervisor/dashboard` | • Direct reports list with milestone tags<br/>• Weekly evaluation matrix (rate 1.0–5.0 across 5 competencies)<br/>• Target 4.0 marker and live gap calculations<br/>• View-only employee directory<br/>• Complete 5-competency statutory rubrics guide |
| **Probationary Employee** | `emp1@acme.com` | `/employee/dashboard` | • Personal 180-day countdown & milestone pill<br/>• 5-Competency performance scorecard<br/>• View assigned AI-recommended training courses |

---

## 🗺️ Live Application Screen Directory (All 13 Screens Complete)

Every single screen is live, responsive, and wired to FastAPI:

| # | Route | Screen Name | Roles Allowed | Status | Key Features |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | `/admin/users` | **User Account Management**| `admin` | ✅ **LIVE** | System-level account provisioning, role picker modal, deactivation, password reset |
| **2** | `/dashboard` | **Employer Dashboard** | `employer` | ✅ **LIVE** | 4 KPI cards, Day 150 milestone alerts, probationers table, AI plan feed |
| **3** | `/employees` | **Employee Directory** | `employer`, `admin`, `supervisor` | ✅ **LIVE** | Tabbed views (All / Probationary / Regular), search, filter, 180-day progress bar. Onboard button exclusive to Employer |
| **4** | `/employees/:id` | **Employee Detail** | `employer`, `admin`, `supervisor`, `probationary_employee` | ✅ **LIVE** | 180-day milestone timeline, 5-score scorecard, audit history, Regularize/Terminate modal |
| **5** | Modal | **Add Employee Modal** | `employer` | ✅ **LIVE** | Exclusive to Employer; Auto-computes Day 180 statutory deadline in `Asia/Manila` |
| **6** | `/rollups` | **Monthly Rollups & Plans**| `employer` | ✅ **LIVE** | 30-day evaluation aggregations, Gemini AI rationales, employer sign-off actions |
| **7** | `/audits` | **DOLE Audit Trail** | `employer` | ✅ **LIVE** | Immutable competency log, prior vs new score diffs, DOLE print/export view |
| **8** | `/supervisor/dashboard`| **Supervisor Workspace** | `supervisor` | ✅ **LIVE** | Quick links, direct reports list, pending evaluations count |
| **9** | `/supervisor/rate` | **Rate Employee Matrix** | `supervisor` | ✅ **LIVE** | 1.0 to 5.0 slider/buttons, 4.0 benchmark indicator, audit warning modal |
| **10**| `/supervisor/rubrics` | **KPI Rubrics Guide** | `supervisor`, `employer`| ✅ **LIVE** | Complete legal standards table for all 5 statutory competencies |
| **11**| `/employee/dashboard` | **Employee Scorecard** | `probationary_employee`| ✅ **LIVE** | 180-day progress, 5-competency radar/scores, status banner |
| **12**| `/employee/training` | **My Training Plans** | `probationary_employee`| ✅ **LIVE** | Assigned training modules with Gemini AI competency rationales |
| **13**| `/settings` | **System Settings** | All Roles | ✅ **LIVE** | 5 Palettes (`paper`, `midnight`, `dusk`, `mist`, `sage`), alert toggles, password |


---

## 🎨 Design System: The 5 Live Theme Palettes

Switchable instantly via the **Palette dropdown in the top-right header** or in **`/settings`**:

1. **`paper` (Default Light)**: Warm cream background (`#f6f3ed`), terracotta accent (`#b94b21`), dark ink text.
2. **`midnight` (Default Dark)**: Obsidian slate (`#090b10`), electric blue accent (`#3b82f6`), crisp white text.
3. **`dusk` (Cosmic Dark)**: Deep violet night (`#0c0a14`), royal purple accent (`#9368f7`).
4. **`mist` (Technical Slate)**: Clean cool gray (`#f0f4f8`), cerulean accent (`#0274af`).
5. **`sage` (Organic Spruce)**: Soft evergreen tint (`#edf2ee`), deep pine accent (`#0f766e`).

---

## 📊 Comprehensive Phase-by-Phase Breakdown

```mermaid
flowchart TD
    P1["Phase 1: DB & Multi-Tenant Core<br/>(DONE - 100%)"] --> P2["Phase 2: Art. 296 Legal Engine<br/>(DONE - 100%)"]
    P2 --> P3["Phase 3: Weekly Evaluations & Audit<br/>(DONE - 100%)"]
    P3 --> P4["Phase 4: ML Risk Classifier<br/>(DONE - 100%)"]
    P4 --> P5["Phase 5: GenAI & Rollups Pipeline<br/>(DONE - 100%)"]
    P5 --> P6["Phase 6: Router & Code Hygiene<br/>(DONE - 100%)"]
    P6 --> P7["Phase 7: Frontend SPA Reconstruction<br/>(DONE - 100%)"]
    P7 --> P7F["Phase 7F: Frontend QA & Accessibility<br/>(DONE - 100%)"]
    P7F --> P8["Phase 8: Pytest Automated Suite<br/>(DONE - 100%)"]

    style P1 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    style P2 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    style P3 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    style P4 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    style P5 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    style P6 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    style P7 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    style P7F fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    style P8 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
```

### ✅ Phase 1: Database & Multi-Tenant Core (100% COMPLETE)
- [x] Asynchronous PostgreSQL via SQLAlchemy 2.0 + asyncpg (`backend/database.py`).
- [x] Complete relational ORM schema (`backend/models.py`) with tenant isolation via `organization_id`.
- [x] Pydantic v2 schemas for all payloads and responses (`backend/schemas.py`).
- [x] JWT Bearer authentication and bcrypt password hashing (`backend/auth.py`).
- [x] Database seed script with deterministic test accounts (`backend/seed.py`).

### ✅ Phase 2: Philippine Labor Code (Article 296) Legal Engine (100% COMPLETE)
- [x] Strict 180-day timeline calculation bounded in `Asia/Manila` timezone (`backend/routers/employees.py`).
- [x] Automated milestone alerts triggered at Day 150, Day 165, and Day 178 (`/api/employees/milestones`).
- [x] Strictly restricted to the 5 statutory competencies:
  1. `task_completion`
  2. `attendance_and_punctuality` (evaluator rating score only; no biometric punch clocks)
  3. `communication_and_teamwork`
  4. `initiative_and_adaptability`
  5. `quality_of_work`

### ✅ Phase 3: Weekly Evaluations & Immutable Audit Trail (100% COMPLETE)
- [x] Weekly evaluation submission endpoint (`POST /api/evaluations/{employee_id}/weekly`).
- [x] Role restrictions: rating submissions limited to `employer` and `supervisor`.
- [x] Live competency scorecard and gap calculation against 4.0 benchmark.
- [x] Append-only, immutable audit trail logging any score change (`/api/evaluations/audit-trail`).

### ✅ Phase 4: Machine Learning Subsystem (100% COMPLETE)
- [x] Synthetic dataset generator (600 rows, stratified 80/20, seed 42) bounded to `[1.0, 5.0]`.
- [x] Airtight deterministic labeling priority cascade:
  - *Critical Gap*: Overall mean < 2.5 OR min(quality, task) < 2.0
  - *Needs Improvement*: Overall mean < 3.5 OR min(score) < 3.0 OR std_dev > 1.0
  - *Meets Expectations*: All other passing distributions
- [x] Random Forest model (`rf_model.joblib`) with 97.5% test accuracy.
- [x] In-memory inference service `predict_employee_risk(scores)` in `backend/ml/predictor.py`.

### ✅ Phase 5: GenAI & Intervention Pipeline (100% COMPLETE)
- [x] Async Google Gemini client with strict `temperature=0.0` and fallback (`backend/gemini.py`).
- [x] Monthly Rollup Pipeline (`POST /api/interventions/{employee_id}/monthly-rollup`).
- [x] Random Forest risk prediction + Course catalog matching + Gemini 2-sentence rationale.
- [x] Employer Digital Sign-off Endpoints (`GET /api/interventions/pending`, `POST /api/interventions/{plan_id}/sign-off`).

### ✅ Phase 6: Router Consolidation & Code Hygiene (100% COMPLETE)
- [x] Purged unused 0-byte router stubs (`admin.py`, `employer.py`, `employee.py`, `supervisor.py`).
- [x] Cleaned up unused empty files (`deps.py`, `security.py`).
- [x] Locked down `backend/requirements.txt` with exact production dependencies.
- [x] Added `GET /` root endpoint returning JSON status and documentation links.

### ✅ Phase 7: Frontend SPA Modernization & Component Architecture (100% COMPLETE)
- [x] **Phase 7A (Foundations)**: Axios client with JWT auto-attachment, 401 interceptor, TanStack Query defaults, React Router guards.
- [x] **Phase 7B (Design Tokens)**: `tokens.css` with 5 palettes, Tailwind mapping, self-hosted Geist fonts, anti-flash `ThemeProvider`.
- [x] **Phase 7C (UI Primitives)**: `Button`, `Badge`, `ScoreMeter` (with 4.0 tick `<u>`), `StatusDot`, `MilestonePill`, `Skeleton`.
- [x] **Phase 7D (AppShell)**: Collapsible sidebar (250px $\rightarrow$ 72px with `[` shortcut), MobileBar, BottomTabBar, Command Palette (`Ctrl+K`).
- [x] **Phase 7E (All Live Pages)**: Migrated and connected all 13 production screens; removed all legacy 0-byte stubs.
- [x] **Build Verification**: `npm run build` succeeds cleanly in under 3 seconds with 0 warnings or errors.

---

## 🎯 Capstone Completion: 100% Shipped

### 1. Phase 7F: Frontend QA & Accessibility Pass (Completed)
- [x] Viewport responsiveness verified at Mobile (375px), Tablet (768px), and Desktop (1280px).
- [x] Contrast verification across all 5 theme palettes (ensuring WCAG AA compliance).
- [x] Keyboard navigation verified (`Tab`, `Enter`, `Esc`, `[` sidebar toggle, `Ctrl+K` command palette).
- [x] Live local browser manual testing completed on `http://localhost:5173`.

### 2. Phase 8: Consolidated Pytest Test Suite & Hardening (Completed)
- [x] `backend/tests/test_auth.py`: Cookie auth & logout, JWT issuance, password rotation, profile self-update, malformed hash defense.
- [x] `backend/tests/test_admin.py`: Tenant supervisor listing, duplicate email 409 conflict, activity log access control, system settings.
- [x] `backend/tests/test_milestones.py`: Article 296 statutory milestone math (Days 150/165/178 in `Asia/Manila`), onboarding supervisor requirements, termination justification.
- [x] `backend/tests/test_evaluations.py`: Weekly KPI rating submission, scorecard gap math against 4.0 benchmark, immutable audit trail with evaluator names and pagination, rubrics defaults & resets, KPI trend.
- [x] `backend/tests/test_interventions_and_ml.py`: Scoped employee interventions, employer/supervisor authorization, monthly rollup idempotency & window filtering, Random Forest risk explanation & feature importances, statutory mid-5th month regularization decision support, dispatch notification workflows, printable executive report.
- [x] `backend/tests/test_rbac.py`: Manuscript RBAC write-lock — Admin/Supervisor denied rollup/dispatch/sign-off/regularization writes; Admin view-only oversight preserved.
- [x] Full Pytest suite executed: **38 passed (100%)**.

---

## 💡 Notes on Planning & The Dual-AI Workflow

### Q: "Should we have made a plan before doing 7C and 7D?"
> **Context**: Phase 7C (UI Primitives: Button, Badge, ScoreMeter, etc.) and Phase 7D (AppShell: Sidebar, Header, Command Palette) were the foundational building blocks required to render the screens in Phase 7E.
>
> We batched them together with Phase 7E directly following the master design specification in `reference/performa-redesign-preview.html` and `tokens.css`. This guaranteed that every primitive and layout component matched the exact design system with zero token discrepancies.
>
> **Going Forward**: For Phase 7F (QA) and Phase 8 (Pytest), we will explicitly review the step-by-step plan first and leverage the **Gemini (Architect / Guard) + DeepSeek (Builder)** pair-programming combo for rapid execution and auditing!
