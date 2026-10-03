# Performa Frontend UI/UX Static Audit

**Scope:** `frontend/src/**` (15 pages, 7 UI primitives, 5 layout components, contexts/utils).
**Method:** static source review only. No browser/visual/responsive/contrast verification performed.
**Severity:** P0 broken/incorrect · P1 clear defect · P2 UX/consistency · P3 polish/dead code.
**Note:** The backend AI model is `gemini-3.5-flash-lite`. A **Tier 1 engineering pass** has since been applied (see "Remediation log" at the bottom): 8 findings resolved, 2 partial. Findings below are marked ✅ Fixed / ◐ Partial / (unmarked = open).

**Status legend:** ✅ Fixed · ◐ Partial · (no marker) = open

---

## A. Copy & correctness (P1)
1. `pages/employer/Dashboard.jsx:226` — `"{n} days to Day 180"` shows "1 days". → pluralize.
2. `pages/employer/Dashboard.jsx:198` — `"{n} probationary employee(s)"` dev shorthand. → "employees".
3. `pages/employee/EmployeeDashboard.jsx:128` — `"{daysRemaining} days remaining until regularization review"` → pluralize.
4. `pages/employees/EmployeeDetail.jsx:319` — `"({daysRemaining} days remaining)"` → pluralize.
5. ✅ **Fixed** — `pages/employer/Rollups.jsx:377` workflow copy read "Gemini **2.5** Flash generates tailored executive rationale" (backend runs `gemini-3.5-flash-lite`). Applied **Option 1**: now "Gemini generates tailored executive rationale." (vendor kept, version dropped).
6. `pages/employer/Rollups.jsx:214` — `plan.competency?.replace('_',' ')` replaces only first `_` → "attendance and_punctuality". → use `/_/g`.
7. `pages/admin/ActivityLog.jsx:97,100` — raw `entry.action` / `entry.entity_type` (e.g., `user.create`) rendered unformatted. → humanize.
8. `pages/notifications/Notifications.jsx:114` — raw `n.category` badge. → format.
9. `pages/employer/Rollups.jsx:286` & `pages/employee/EmployeeDashboard.jsx:288` — raw `status_classification` shown (snake_case likely). → humanize.
10. `pages/settings/Settings.jsx:248` — "Organization" displays raw slug `user.organization_id` (e.g., `acme-ph`). → show org name.
11. `pages/supervisor/RateEmployee.jsx:303` — UI label contains ASCII `">= 4.0"`. → "≥ 4.0".
12. `pages/employees/Employees.jsx:66-67` — stale/duplicated comment ("Compute days elapsed…" immediately followed by "Filter and sort employees"). → remove.

## B. Jargon exposed to end users (P2)
13. `Dashboard.jsx:183,347` — "ML Random Forest gap classifier", "Automated Random Forest course assignments".
14. `Rollups.jsx:134,376` — "Random Forest", "Gemini Performance Summaries".
15. `EmployeeDetail.jsx:509-511` — "ML Risk Explanation / Feature importance for legal defensibility".
→ Consider business-language labels for employer/supervisor audiences.

## C. Logic / data-correctness (P1)
16. `Dashboard.jsx:179` — `{stats.pendingPlans || plans.length}` shows total plans when pending = 0, contradicting the label. → use one source.
17. `RateEmployee.jsx:50-56` — ratings **pre-filled** (attendance 4.5, initiative 3.5). A supervisor can submit without touching anything → biasing/validity risk. → default all to neutral or require explicit input.
18. `RateEmployee.jsx:176` — fallback date uses `new Date().toISOString()` (**UTC**), inconsistent with the app's Asia/Manila standard → off-by-one possible. → use `manilaTodayISO()`.
19. `AddEmployeeModal.jsx:36-49` — Day-180 preview computed with `new Date(start)` (UTC) + `setDate`, while `EmployeeDetail.jsx:349` uses `parseDateOnly + 180d`. Two different Day-180 calculations. → centralize.
20. `Settings.jsx:380-442` — statutory alerts labeled "Mandatory" (line 364) but are user-toggleable and persist **only to localStorage** (never enforced server-side). Legal/UX contradiction. → clarify or wire to backend.
21. `Rubrics.jsx:22-84` — level bands ("4.0–4.5 Proficient") are **hardcoded** while weight/target come from DB; changing the target via KPI config leaves band text stale. → derive bands from configured target.
22. `Employees.jsx:99-105` — sort branch for `department` exists but no UI can select it (only name/day). Dead branch / incomplete feature.
23. `UserManagement.jsx:89` — `formatDate` uses local `new Date()` (not Manila) for `created_at`. → unify.
24. Hardcoded "4.0 / 5.0" target in `Dashboard.jsx:161-165`, `SupervisorDashboard.jsx:91`, `RateEmployee.jsx:268`, `EmployeeDashboard.jsx:175`, `EmployeeDetail.jsx:380` — not sourced from KPI rubric config. → single source of truth.

## D. Redundancy / information architecture (P2)
25. `Dashboard.jsx` — the same 3 urgent employees appear in the KPI count (`:151`), alert cards (`:212`), and pipeline table (`:273`), with duplicated milestone pills + day-left. → collapse to two surfaces.
26. `Employees.jsx:344-378` — timeline bar urgency color **and** `MilestonePill` encode the same status per row (also on Dashboard). → acceptable but redundant.
27. `Rubrics.jsx` — full rubric text hardcoded in-page (173 lines) rather than served from the KPI config API. → drift risk.
28. Two overlapping audit surfaces: `/audits` (score changes) vs `/admin/activity` (user actions); Admin sidebar shows both "Activity Log" and "Audit Trail" without explaining the difference.

## E. Accessibility (P1)
29. ✅ **Fixed** — keyboard-inaccessible click targets. `Dashboard.jsx` rows/cards, `Employees.jsx` rows, and `Settings.jsx` palette cards now set `tabIndex` plus `role`/`aria-pressed` where appropriate, with an `onKeyDown` handler (`utils/a11y.js` `activateOnKey`) so Enter/Space activates them.
30. ✅ **Fixed** — focus indicator. `index.css` `:focus-visible` now uses `outline: 2px solid var(--accent) !important`, so the ring stays visible even on inputs that set `focus:outline-none`.
31. **Toggle focus removed:** `Settings.jsx:394,417,440` use `peer-focus:outline-none` on the switch track → no keyboard focus indicator.
32. ◐ **Partial** — close buttons in `UserManagement`, `Rollups`, and `EmployeeDetail` now have `aria-label="Close"`. Still open: no focus trap / initial focus in any modal, and the `RateEmployee.jsx` confirm modal still lacks `role="dialog"`/`aria-modal`/label.
33. ✅ **Fixed** — icon-only buttons. `aria-label="Close"` added to the close buttons in `UserManagement.jsx`, `Rollups.jsx`, and `EmployeeDetail.jsx`.
34. ✅ **Fixed** — search inputs. `aria-label` added: `UserManagement.jsx` ("Search users"), `AuditTrail.jsx` ("Search audit trail"), `Employees.jsx` ("Search employees").
35. ✅ **Fixed** — `prefers-reduced-motion`. Global `@media (prefers-reduced-motion: reduce)` block in `index.css` neutralizes animations/transitions.
36. `AuditTrail.jsx:88` "Print Compliance Log" calls `window.print()` with no print stylesheet → printed output likely poor.
37. Tables lack `<caption>` and `scope` on `<th>` (minor).

## F. Responsive / layout (P2, unverified visually)
38. Wide tables (5–6 cols) rely on horizontal scroll on mobile: `AuditTrail`, `ActivityLog`, `UserManagement`, `Employees`, `Dashboard` → consider mobile card layout.
39. `RateEmployee.jsx:311` — 9 rating buttons in one `flex` row; cramped on small screens.
40. `MobileBar.jsx:13-16` — sub-page detection via `pathname.includes('/rate'|'/rubrics')` is brittle (could match unintended routes).

## G. State-handling gaps (P2)
41. Missing error/loading UI on several queries:
   - `Rollups.jsx:92` summaries (no loading/error)
   - `EmployeeDashboard.jsx:56` summaries; scorecard/audit have no `isError`
   - `EmployeeDetail.jsx:94-113` trend/regularization/risk (retry:false, no error UI)
   - `Rubrics.jsx:8` kpi rubrics (no loading/error)
   - `RateEmployee.jsx:27` employees (loading only, no error)
42. `Notifications.jsx` mark-read mutations surface no error feedback.
43. No shared toast/banner system — each page reimplements inline feedback (`UserManagement`, `Rollups`, `Settings`).

## H. Consistency / terminology (P2)
44. Same action, four names: "Rate Staff" (`Dashboard`, `SupervisorDashboard`), "Rate Employee" (nav, `EmployeeDetail`), "Rate Probationary Employee" (`RateEmployee`).
45. Same target, many names: "Regularizing Target", "Passing Target", "Threshold Target", "Regularizing Benchmark", "Statutory regularizing standard".
46. Same feature, many names: "AI Training Plans", "AI Training Recommendations", "Training Interventions", "Assigned Training Interventions", "Rollups & AI Plans", "Monthly Rollups & AI Sign-Off".
47. ✅ **Fixed** — `getInitials()` centralized in `utils/format.js` (7+ → 1); all local `formatDate()` copies removed in favor of `utils/datetime.js` (which gained a `seconds` option to keep each screen's output byte-identical).
48. `Badge` `sm` size forces `font-mono` on role badges ("Admin", "Employer") — mono for words is unusual.
49. `ScoreMeter.jsx:52-57` target marker conveys meaning only via `title` (hover) — not accessible/keyboard-reachable.

## I. Role / security UX (P1 — manuscript alignment)
50. `App.jsx:162,180,188,196` — routes `/rollups` and `/supervisor/*` still allow `admin` (and `/employees/:id` shows full scorecard/risk/regularization to admin). This contradicts the stated fix that Admin must not view employee performance analytics. → tighten guards.
51. `Dashboard.jsx:113-118` — Employer's primary CTA "Rate Staff" navigates to `/supervisor/rate`; employer is treated as a rater (`EmployeeDetail.jsx:183` `canRate = supervisor || employer`). Confirm intended per manuscript.
52. `AddEmployeeModal.jsx:19,286` — default password `Password123!` prefilled **and displayed**. → for non-demo, force-set or randomize.
53. `UserManagement.jsx` reset-password modal has no confirm field (Settings does) — inconsistent credential UX.

## J. Dead code / unused imports (P3)
54. ◐ **Partial** — cleaned during nav centralization: `Sidebar.jsx`, `BottomTabBar.jsx`, `CommandPalette.jsx`. Still unused: `Dashboard.jsx` (`ScoreMeter`, `StatusDot`, `Calendar`, `Clock`, `ArrowRight`); `EmployeeDashboard.jsx` (`Calendar`, `Clock`, `BookOpen`, `Building`, `TrendingUp`, `ShieldCheck`, `AlertCircle`, `CheckCircle2`); `AuditTrail.jsx` (`Filter`, `Clock`, `FileText`); `UserManagement.jsx` (`Users`, `Lock`, `Building2`); `Rollups.jsx` (`Clock`, `BookOpen`, `Building`, `Calendar`, `Plus`); `Settings.jsx` (`ShieldAlert`); `EmployeeDetail.jsx` (`Clock`, `UserCheck`, `UserX`); `RateEmployee.jsx` (`StatusDot`, `ArrowRight`, `Calendar`, `Building`, `User`); `SupervisorDashboard.jsx` (`CheckCircle2`); `Employees.jsx` (`Filter`).
55. ✅ **Fixed** — duplicate local `formatDate`/`getInitials` helpers removed (see 47).

---

## Summary counts
| Category | Items | Highest severity | Resolved |
|---|---|---|---|
| Copy/correctness | 12 | P1 | 1 (item 5) |
| Jargon | 3 | P2 | 0 |
| Logic/data | 9 | P1 | 0 |
| Redundancy/IA | 4 | P2 | 0 |
| Accessibility | 9 | P1 | 5 (29, 30, 33, 34, 35) + 1 partial (32) |
| Responsive | 3 | P2 | 0 |
| State handling | 3 | P2 | 0 |
| Consistency | 6 | P2 | 1 (47) |
| Role/security | 4 | P1 | 0 |
| Dead code | 2 | P3 | 1 (55) + 1 partial (54) |
| **Total** | **55** | — | **8 resolved · 2 partial · 45 open** |

## Not verifiable statically (needs browser pass)
- Actual color contrast (many `text-[10px]/[11px]` + `ink-3` usages).
- Real responsive behavior/breakpoints and mobile table cramping.
- Focus/hover feel, modal focus trapping, print output rendering.

## Suggested priority for remediation (remaining)
- **P0/P1 first:** 16, 17, 18, 19 (data correctness); 31, 32 (remaining keyboard/modal a11y); 50–52 (role guards / manuscript alignment).
- **P2:** 1–4, 6, 9, 25, 38, 41–46, 48.
- **P3:** 36, 37, 54.

---

## Remediation log — Tier 1 engineering pass

Applied to the **current `frontend/`** (not the external `performa-ui-kit`). Engineering-only; no visual redesign.

**New files**
- `src/utils/format.js` — shared `getInitials`.
- `src/utils/a11y.js` — `activateOnKey` (Enter/Space activation).
- `src/config/nav.js` — single role→nav source (paths/icons + per-surface labels) consumed by `Sidebar`, `BottomTabBar`, `CommandPalette` (removes 3× duplication; the drift that caused the Admin "System Overview" bug).
- `src/config/domain.js` — `PROBATION_DAYS`, milestone constants, `COMPETENCIES`.

**Modified**
- `src/index.css` — `:focus-visible` `!important` ring; `prefers-reduced-motion` guard.
- `components/layout/{Sidebar,BottomTabBar,CommandPalette,MobileBar}.jsx` — consume `config/nav.js`; shared `getInitials`; removed unused imports.
- `components/ui/MilestonePill.jsx` — thresholds from `config/domain.js`.
- Pages (`Dashboard`, `Employees`, `EmployeeDetail`, `SupervisorDashboard`, `UserManagement`, `AuditTrail`, `ActivityLog`, `Notifications`, `EmployeeDashboard`, `Rollups`, `Settings`) — shared `getInitials`/`formatDate`, domain constants, keyboard-activatable rows/cards, `aria-label`s, and `role="tablist"` segmented controls.
- `src/utils/datetime.js` — `formatDate` gained a `seconds` option.

**Verification:** `npm run build` ✅ · `python -m pytest -q` ✅ 30 passed.

**Explicitly deferred (would be visual/design changes, not engineering):** container queries, 44px touch targets, `VITE_USE_MOCK` role preview, pre-render theme anti-flash.
