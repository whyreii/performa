# Performa Frontend UI/UX Master Audit & Remediation Tracker

**Scope:** `frontend/src/**` (15 pages, 7 UI primitives, 5 layout components, contexts/utils).  
**Method:** Static source review + live browser validation + accessibility & manuscript alignment.  
**Severity:** P0 broken/incorrect · P1 clear defect · P2 UX/consistency · P3 polish/dead code.  
**Backend AI Model:** `gemini-3.5-flash-lite` (officially locked).  
**Status Legend:** ✅ Fixed · 🛡️ Preserved (Thesis Requirement) · ◐ Partial · (no marker) = Open

---

## A. Copy & Correctness (P1)
1. ✅ **Fixed** — `pages/employer/Dashboard.jsx:226` — `"{daysLeft} day/days to Day 180"` properly pluralized.
2. ✅ **Fixed** — `pages/employer/Dashboard.jsx:198` — `"{n} probationary employee/employees"` properly pluralized.
3. ✅ **Fixed** — `pages/employee/EmployeeDashboard.jsx:115` — `"{daysRemaining} day/days remaining until regularization review"` properly pluralized.
4. ✅ **Fixed** — `pages/employees/EmployeeDetail.jsx:301` — `"({daysRemaining} day/days remaining)"` properly pluralized.
5. ✅ **Fixed** — `pages/employer/Rollups.jsx:377` — Workflow copy updated to "Gemini generates tailored executive rationale."
6. ✅ **Fixed** — `pages/employer/Rollups.jsx:214` — Global regex `plan.competency?.replace(/_/g, ' ')` applied so multi-word competencies render with spaces.
7. `pages/admin/ActivityLog.jsx:97,100` — raw `entry.action` / `entry.entity_type` (e.g., `user.create`) rendered unformatted. → humanize.
8. `pages/notifications/Notifications.jsx:114` — raw `n.category` badge. → format.
9. ✅ **Fixed** — `pages/employer/Rollups.jsx:286` & `pages/employee/EmployeeDashboard.jsx:275` — `status_classification` capitalized and formatted without underscores.
10. ✅ **Fixed** — `pages/settings/Settings.jsx:248` — Organization displays formal company name ("Acme Philippines Corp.") alongside slug.
11. ✅ **Fixed** — `pages/supervisor/RateEmployee.jsx:303` — UI label upgraded to unicode `"≥ 4.0"`.
12. `pages/employees/Employees.jsx:66-67` — stale/duplicated comment ("Compute days elapsed…" immediately followed by "Filter and sort employees"). → remove.

---

## B. Explainable AI & Technical Transparency (Thesis Core Deliverable)
> [!NOTE]
> Items 13–15 were originally flagged by DeepSeek as "jargon to remove", but were **intentionally preserved** to satisfy the thesis defense grading criteria for Explainable Machine Learning (XAI) and substantive due process under Philippine Labor Code Article 296.

13. 🛡️ **Preserved (Thesis Core)** — `Dashboard.jsx:179,347` — "ML Random Forest gap classifier" and "Automated Random Forest course assignments" intentionally kept visible for academic panel demonstration.
14. 🛡️ **Preserved (Thesis Core)** — `Rollups.jsx:134,376` — "Random Forest" model transparency and "Gemini Performance Rationale" kept visible.
15. 🛡️ **Preserved (Thesis Core)** — `EmployeeDetail.jsx:509-511` — "ML Risk Explanation / Feature importance for legal defensibility" retained to satisfy Article 296 evidentiary standards.

---

## C. Logic / Data-Correctness (P1)
16. ✅ **Fixed** — `Dashboard.jsx:175` — `{stats.pendingPlans ?? plans.length}` prevents showing total when pending is zero.
17. ✅ **Fixed** — `RateEmployee.jsx:50-56` — Ratings now default to a clean neutral `4.0` regularizing benchmark across all 5 competencies.
18. ✅ **Fixed** — `RateEmployee.jsx:176` — Fallback date uses `formatDate(new Date())` (Asia/Manila standard), preventing morning UTC date drift.
19. `AddEmployeeModal.jsx:36-49` — Day-180 preview computed with `new Date(start)` (UTC) + `setDate`, while `EmployeeDetail.jsx:349` uses `parseDateOnly + 180d`. → centralize with `utils/datetime.js`.
20. `Settings.jsx:380-442` — statutory alerts labeled "Mandatory" (line 364) persist to localStorage. → clarify or wire to backend tenant config.
21. `Rubrics.jsx:22-84` — level bands ("4.0–4.5 Proficient") hardcoded while weight/target come from DB. → derive bands from configured target.
22. `Employees.jsx:99-105` — sort branch for `department` exists but no UI selector exists. → add UI control or clean branch.
23. `UserManagement.jsx:89` — `formatDate` uses local `new Date()` for `created_at`. → unify.
24. 🛡️ **Preserved (Legal Anchor)** — Hardcoded "4.0 / 5.0" regularizing benchmark across scorecards is anchored in `config/domain.js` as the statutory standard under Article 296.

---

## D. Information Architecture & Audit Surfaces (P2)
25. `Dashboard.jsx` — urgent employees appear in KPI count, alert cards, and pipeline table. → check if visual collapse is desired.
26. `Employees.jsx:344-378` — timeline bar urgency color and `MilestonePill` both encode status.
27. `Rubrics.jsx` — rubric text hardcoded in-page rather than served from API.
28. 🛡️ **Preserved (Legal Separation)** — `/audits` (Evidentiary DOLE Labor Score Trail) and `/admin/activity` (IT Sysadmin Security Log) serve distinct legal and operational requirements and are intentionally kept separate.

---

## E. Accessibility & WCAG 2.1 Level AA (P1)
29. ✅ **Fixed** — Keyboard-inaccessible click targets resolved via `activateOnKey` on Enter/Space.
30. ✅ **Fixed** — High-contrast `2px solid var(--accent) !important` focus indicator globally active.
31. ✅ **Fixed** — `Settings.jsx:394,417,440` switch tracks now feature `peer-focus-visible:ring-2 peer-focus-visible:ring-accent` focus rings.
32. ✅ **Fixed** — Close buttons have `aria-label="Close"`; confirmation modal in `RateEmployee.jsx` has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
33. ✅ **Fixed** — Icon-only buttons have descriptive `aria-label`s.
34. ✅ **Fixed** — Search inputs in UserManagement, AuditTrail, and Employees have `aria-label`s.
35. ✅ **Fixed** — Global `@media (prefers-reduced-motion: reduce)` block in `index.css`.
36. ✅ **Fixed** — `AuditTrail.jsx` now features dedicated `@media print` styling, formal DOLE headers, and physical signature lines (`Evaluator`, `Employee`, `HR Head`).
37. Tables lack `<caption>` and `scope` on `<th>`.

---

## F. Responsive Layout (P2)
38. Wide tables (5–6 cols) rely on horizontal scroll on mobile (375px) — consider responsive cards for Mobile view.
39. `RateEmployee.jsx:311` — 9 rating buttons in one flex row; verify touch target spacing on mobile.
40. `MobileBar.jsx:13-16` — sub-page title detection using route matching.

---

## G. State Handling & Feedback (P2)
41. Loading / error states on query hooks:
    - `Rollups.jsx` summaries query
    - `EmployeeDashboard.jsx` scorecard & summaries
    - `EmployeeDetail.jsx` trend, regularization, and risk queries
42. `Notifications.jsx` mark-read mutations error feedback.
43. ✅ **Fixed** — Lightweight floating glassmorphism toast system implemented (`ToastContext.jsx`) and wired into rating, status transition, and copy actions.

---

## H. Consistency & Terminology (P2)
44. Action label alignment: unify "Rate Staff" vs "Rate Employee" across surfaces.
45. Target label alignment: standardize references to the "4.0 Statutory Regularizing Standard".
46. Feature label alignment: standardize references to "AI Training Recommendations".
47. ✅ **Fixed** — Centralized `getInitials` and `formatDate` in `src/utils/`.
48. `Badge` `sm` size forces `font-mono` on role badges.
49. ✅ **Fixed** — `ScoreMeter.jsx` now has semantic `role="meter"` with ARIA min/max values.

---

## I. Role & Security Alignment (P1 — Manuscript Integrity)
50. ✅ **Fixed (Manuscript-aligned)** — Admin RBAC corrected to the Scope of the Study. Admin retains **view-only** access to employee records, scorecards, evaluations, and performance/activity reports; **write** actions are now Employer-only: employee onboarding (`POST /api/employees/`), status change (`PATCH /api/employees/{id}/status`), and KPI upsert/reset (`/api/kpi-rubrics`) require `EMPLOYER`, and `EmployeeDetail` hides the status button from Admin. (Supersedes the earlier route-only change that over-restricted Admin relative to the manuscript.)
51. ✅ **Resolved (Manuscript)** — `Dashboard.jsx:113-118` — Employer rating is in scope: the Scope of the Study grants the Employer "Performance Rating Entry," and the Delimitations state ratings are recorded exclusively by the Employer or Supervisor. Code and UI are correct.
52. `AddEmployeeModal.jsx` — Default temporary demo password UX.
53. `UserManagement.jsx` — Password reset modal UX.

---

## J. Dead Code & Hygiene (P3)
54. Clean remaining unused icon imports across pages (`Dashboard.jsx`, `AuditTrail.jsx`, `Rollups.jsx`, etc.).
55. ✅ **Fixed** — Duplicate local `formatDate` and `getInitials` helpers completely removed.

---

## 📊 Summary Scorecard

| Status | Count | Description |
| :--- | :---: | :--- |
| ✅ **Fixed** | **25** | Code, date, regex, pluralization, a11y, print styles, toasts, and manuscript RBAC write-lock resolved |
| 🛡️ **Preserved** | **4** | Core thesis pillars (XAI Random Forest, 4.0 benchmark, dual audit trails) protected |
| ◐ **Partial** | **1** | Modal focus trapping / dialog attributes across remaining pages |
| 📋 **Open** | **25** | Remaining UX consistency and mobile responsive polish items |
| **Total Items Audited** | **55** | Comprehensive static + dynamic coverage |
