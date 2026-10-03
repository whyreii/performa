# Performa Frontend QOL (Quality of Life) Enhancements Master Plan

## 🎯 Strategic Objective
Elevate the Performa Capstone platform from a "working prototype" to an authentic, commercial-grade compliance platform. Every feature in this plan directly supports:
1. **Academic & Legal Integrity**: Reinforces **Philippine Labor Code Article 296** statutory milestones and DOLE/NLRC evidentiary standards.
2. **Defense Panel Impact**: Provides effortless, visual demonstrations during live defense walkthroughs.
3. **Enterprise Usability**: Eliminates repetitive actions and provides instant feedback for HR and evaluators.

---

## 📋 Feature Roadmap & Scope Status

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PERFORMA QOL ROADMAP                            │
├────┬─────────────────────────────┬──────────┬──────────────────────────┤
│ #  │ Feature Name                │ Status   │ Defense / Legal Value    │
├────┼─────────────────────────────┼──────────┼──────────────────────────┤
│ 1  │ 🎭 Persona Switcher         │ ❌ DROPPED│ Rejected (keeps auth)   │
├────┼─────────────────────────────┼──────────┼──────────────────────────┤
│ 2  │ 🍞 Floating Glass Toast     │ ✅ IN SCOPE│ Premium SaaS feedback   │
├────┼─────────────────────────────┼──────────┼──────────────────────────┤
│ 3  │ 🏷️ Milestone Filter Chips   │ ✅ IN SCOPE│ Art. 296 milestone triage│
├────┼─────────────────────────────┼──────────┼──────────────────────────┤
│ 4  │ 📋 DOLE Legal Notice Copy   │ ✅ IN SCOPE│ Written notice standard  │
├────┼─────────────────────────────┼──────────┼──────────────────────────┤
│ 5  │ 🖨️ Print-Ready Audit Sheet  │ ✅ IN SCOPE│ Resolves Audit Item #36  │
├────┼─────────────────────────────┼──────────┼──────────────────────────┤
│ 6  │ ⌨️ Keyboard Modal (`?`)      │ ✅ IN SCOPE│ Power-user accessibility │
├────┼─────────────────────────────┼──────────┼──────────────────────────┤
│ +A │ 🇵🇭 Manila Statutory Clock   │ 💡 OPTION │ Art. 296 Timezone anchor │
│ +B │ 📈 4.0 Benchmark Trend Line │ 💡 OPTION │ Visual pass/gap line     │
└────┴─────────────────────────────┴──────────┴──────────────────────────┘
```

---

## Detailed Specification: Approved Features

### Feature 2: 🍞 Floating Glassmorphism Toast System
* **Current Issue**: System confirmations (e.g. approving a training plan, switching themes, saving ratings) either redirect or use inline layout-shifting messages.
* **Implementation Design**:
  - Create `frontend/src/context/ToastContext.jsx` and `frontend/src/components/ui/Toast.jsx`.
  - Floating container fixed at bottom-right (`z-50 space-y-2.5 pointer-events-none`).
  - Glassmorphic styling matching `tokens.css`: `backdrop-blur-md bg-surface/90 border border-line shadow-pop`.
  - 4 Semantic types:
    - **Success** (Emerald icon): *"Weekly evaluation recorded and immutably hashed to DOLE audit trail."*
    - **Info** (Accent icon): *"Theme switched to Sapphire."*
    - **Warning** (Amber icon): *"Employee is approaching the Day 165 statutory notice window."*
    - **Error** (Rose icon): *"Failed to update evaluation."*
  - Auto-dismisses in 3.5 seconds; dismissable via `×` button; accessible via `role="status"` and `aria-live="polite"`.

---

### Feature 3: 🏷️ Quick Milestone Filter Chips on Employee Roster
* **Manuscript Grounding**: Chapter 1 & Chapter 3 explicitly define the 180-day probation timeline with strict statutory thresholds at **Day 150 (Appraisal)**, **Day 165 (15-Day Written Notice)**, and **Day 178 (Critical 48h to Auto-Regularization)**.
* **Implementation Design**:
  - In [`frontend/src/pages/employees/Employees.jsx`](file:///d:/projects/performa/frontend/src/pages/employees/Employees.jsx), add interactive pill filter chips above the roster:
    - `[All (4)]` (Neutral slate)
    - `[🔥 Critical Day 178 (1)]` (Red badge: `border-bad/30 bg-bad/10 text-bad`)
    - `[⚠️ Notice Day 165 (1)]` (Amber badge: `border-warn/30 bg-warn/10 text-warn`)
    - `[📋 Appraisal Day 150 (1)]` (Blue badge: `border-accent/30 bg-accent/10 text-accent`)
    - `[✅ Nominal / Early (1)]` (Muted emerald: `border-good/30 bg-good/10 text-good`)
  - 1-click filtering: instantly filters the roster so an HR manager or employer can immediately triage employees nearing legal deadlines.

---

### Feature 4: 📋 One-Click DOLE Legal Notice Summary
* **Manuscript & Legal Grounding**: Under Philippine Supreme Court jurisprudence (*Abbott Laboratories v. Alcaraz*) and DOLE regulations, non-regularization requires a written notice stating the statutory standards, actual scores, and gap areas.
* **Implementation Design**:
  - In [`frontend/src/pages/employees/EmployeeDetail.jsx`](file:///d:/projects/performa/frontend/src/pages/employees/EmployeeDetail.jsx), add a `"Copy Legal Summary"` button next to "Export Report".
  - One-click copy generates a formatted, legal-grade plain-text memorandum straight to the clipboard:
    ```text
    ========================================================================
    REPUBLIC OF THE PHILIPPINES | LABOR CODE ARTICLE 296
    STATUTORY PROBATIONARY EVALUATION NOTICE
    ========================================================================
    Date Generated: October 3, 2026 (Asia/Manila Standard Time)
    Tenant: Acme Philippines Corp. (acme-ph)
    Employee Name: Maria Midterm
    Job Title / Department: QA Engineer · Engineering
    Start Date: May 4, 2026 | Day Elapsed: Day 152 of 180
    Statutory Milestone Status: DAY 150 PERFORMANCE REVIEW (TRIGGERED)

    1. STATUTORY BENCHMARK
       Mandatory Regularizing Standard: 4.00 / 5.00 across all 5 competencies
       Current Overall Score: 3.80 / 5.00 [BELOW BENCHMARK]

    2. COMPETENCY SCORE BREAKDOWN
       • Task Completion: 3.50 / 5.00 [GAP: -0.50]
       • Attendance & Punctuality: 4.20 / 5.00 [MET]
       • Communication & Teamwork: 3.20 / 5.00 [GAP: -0.80]
       • Initiative & Adaptability: 4.00 / 5.00 [MET]
       • Quality of Work: 4.10 / 5.00 [MET]

    3. ASSIGNED INTERVENTIONS
       • QC Standards Refresher (Completed)
       • Cross-Team Standup Protocol (In Progress)

    4. STATUTORY NOTICE TIMELINE
       Day 165 Written Notice Deadline: October 16, 2026 (15-Day Buffer)
       Day 180 Legal Ceiling: October 31, 2026 (Auto-Regularization)
    ========================================================================
    ```
  - Displays a toast confirmation: *"Statutory legal notice copied to clipboard."*

---

### Feature 5: 🖨️ Print-Ready Evidentiary Audit Sheet (`@media print`)
* **Manuscript Grounding**: Directly resolves **Audit Item #36** in [`docs/UIUX_AUDIT.md`](file:///d:/projects/performa/docs/UIUX_AUDIT.md). In DOLE inspections or NLRC labor arbitrations, digital screens are inadmissible without signed, physical printouts.
* **Implementation Design**:
  - In `frontend/src/index.css`, implement `@media print` rules:
    - Hide sidebars, navigation headers, search inputs, pagination, and theme buttons.
    - Set background to pure white and text to crisp monochrome black.
    - Add a formal print header:
      `REPUBLIC OF THE PHILIPPINES — DOLE STATUTORY EVALUATION AUDIT`
      `Tenant: Acme Philippines Corp. | Generated: [Date] (Asia/Manila)`
    - Append formal physical signature lines at the bottom of the audit table:
      - `Evaluator Signature: _______________________`
      - `Employee Acknowledgment: _______________________`
      - `Employer / HR Head Attestation: _______________________`

---

### Feature 6: ⌨️ Keyboard Shortcut Cheat Sheet Modal (`?`)
* **Current Issue**: The platform includes power-user shortcuts (`Ctrl+K` for command search, `[` to toggle sidebar, `Esc` to close modals, `Tab` for focus rings), but users have no in-app way to discover them.
* **Implementation Design**:
  - Global listener in [`AppShell.jsx`](file:///d:/projects/performa/frontend/src/components/layout/AppShell.jsx) on `'?'` keydown (when not typing in an input).
  - Sleek modal displaying categorized shortcuts:
    - **Navigation**: `G then D` (Dashboard), `G then E` (Employees), `G then A` (Audit Trail)
    - **Actions**: `/` (Focus Search), `Ctrl+K` (Command Palette), `Ctrl+P` (Print Log)
    - **Window**: `[` (Toggle Sidebar), `Esc` (Dismiss Modal / Close Dialog)

---

## 💡 Two Optional Additions (Your Choice)

1. **Option A: 🇵🇭 Asia/Manila Statutory Time Clock in Header**:
   - A subtle digital badge in the top navigation bar showing: `🇵🇭 Manila (UTC+8) · 16:02:15`.
   - Visually reinforces to the defense panel that all statutory countdowns and cutoffs strictly adhere to Philippine Standard Time.
2. **Option B: 📈 Statutory 4.0 Benchmark Reference Line on Trend Charts**:
   - In [`EmployeeDetail.jsx`](file:///d:/projects/performa/frontend/src/pages/employees/EmployeeDetail.jsx), add a dashed gold reference line at `4.0` across the 180-day trend chart with a small label: *"Statutory 4.0 Standard"*.
   - Allows anyone viewing the chart to immediately see which weeks were below benchmark and which were proficient.

---

## 🛠️ Verification & Safety Protocol
1. `npm run build` in `frontend/` must complete with 0 errors.
2. `python -m pytest backend/tests/ -q` must pass with 0 errors.
3. No regressions to the 5 themes, WCAG AA contrast, or existing route guards.
