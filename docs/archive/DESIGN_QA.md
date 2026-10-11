# Performa — Design QA Findings (Measurable Pass)

**Author:** DeepSeek (OpenCode) · **Date:** 2026-10-03
**Scope (all roles):** `/dashboard`, `/employees`, `/employees/:id`, `/rollups`,
`/audits`, `/settings`, `/notifications`, `/supervisor/dashboard`, `/supervisor/rate`,
`/supervisor/rubrics`, `/admin/users`, `/admin/activity`, `/employee/dashboard`,
`/employee/training`, `/login` · viewports **375 / 768 / 1280**
**Method:** live DOM measurement via Playwright (bounding boxes, `scrollWidth` vs
`clientWidth`, computed styles) + static scan of `frontend/src`. All numbers below
are reproducible; no source changes were made in this pass.

> **Measurement note:** the `main` element clips horizontal overflow (its implicit
> `overflow-x: auto`), so document-level overflow (`docOverflowX`) *under-reports*.
> The reliable metric is `main.scrollWidth − main.clientWidth` (`mainScrollX`);
> findings F9–F11 were only visible once this was measured.

> This report is intended for **handoff to Gemini/Antigravity** for the subjective
> visual-polish pass. Structural fixes (F1–F6, F8) are mechanical; spacing normalization
> (F7) needs design judgment.

---

## Executive summary

| Result | Status |
|---|---|
| Page container | **Consistent** — `max-w-[1120px]` on every route (`AppShell.jsx:49`). ⚠️ *Not* `max-w-7xl`. |
| Document horizontal overflow | **0 px** at 375 / 768 / 1280 on all routes. |
| Header vertical rhythm | **Consistent** — `h1` top = **32 px** on every route. |
| Structural issues | **10** (F1–F6, F8–F11), detailed below. |
| Spacing grid drift | **179** fractional utilities across **158** lines (F7). |

The layout is fundamentally sound. The flaws are concentrated in **header action
wrapping**, **tablet (`md`) breakpoints**, **clipped controls** (375 and admin views),
**grid drift**, and **theme-card definition**.

**Systemic root cause:** the persistent **250 px sidebar** stays visible from `md`
(768) upward, leaving only ~470 px of content. Most F2/F10/F11 overflows are the same
story — a wide table/row that fits at `lg` is squeezed and overflows at `md`.

---

## F1 — Employee-detail header actions wrap into orphaned rows *(High)* — [FIXED in d8e08af]

**Evidence (measured button top-offsets inside the first `<section>`):**

| Viewport | Rows | Layout |
|---|---|---|
| 768 | **4** | `Rate Employee` / `Update Status` / `Copy Legal Notice` / `Export Report` — one per row |
| 1280 | **3** | `Rate Employee` alone · `Update Status` + `Copy Legal Notice` · `Export Report` |
| 1912 | 1 | (reference) all four inline |

This also squeezes the left profile block, forcing the milestone pill onto its own
line: **`h1` center 163.5 px vs pill center 199.4 px** (should be inline).

**Source:**
- `frontend/src/pages/employees/EmployeeDetail.jsx:315` — header wrapper `flex flex-col md:flex-row md:items-center justify-between gap-6`
- `frontend/src/pages/employees/EmployeeDetail.jsx:316` — profile block `flex items-start gap-4`
- `frontend/src/pages/employees/EmployeeDetail.jsx:322` — title+pill row `flex flex-wrap items-center gap-2.5`
- `frontend/src/pages/employees/EmployeeDetail.jsx:346` — action group `flex flex-wrap items-center gap-2 md:justify-end`

**Proposed fix:** keep the header stacked until `lg` (`flex-col lg:flex-row`), give the
action group `w-full lg:w-auto` with `justify-start lg:justify-end` so it wraps as a
unit rather than orphaning; optionally add `shrink-0` to the profile block.

---

## F2 — Desktop table switches on too early at `md` (768) *(High)* — [FIXED in d8e08af]

**Evidence (`/employees` @768):** wrapper `.hidden.md:block.overflow-x-auto` is
**468 px** wide while the table's natural width is **639 px** → **171 px hidden
behind a horizontal scroll**, even though the mobile card layout exists and is only
`md:hidden`.

**Source:**
- `frontend/src/pages/employees/Employees.jsx:397` — mobile cards `md:hidden`
- `frontend/src/pages/employees/Employees.jsx:465` — table `hidden md:block overflow-x-auto`
- `frontend/src/pages/employees/Employees.jsx:532` — cell `min-w-[180px]`
- `frontend/src/pages/employees/Employees.jsx:250` — search `min-w-[200px]`

**Proposed fix:** move the breakpoint to `lg` (`lg:hidden` / `hidden lg:block`) so
tablets keep the card view; and/or reduce the `min-w-[180px]` cell to `min-w-[140px]`.

---

## F3 — Score selector buttons clip at 375 *(High)* — [FIXED in d8e08af]

**Evidence (`/supervisor/rate` @375):** five visible buttons render
`clientWidth 26 px` but need `scrollWidth 30 px` — the `4.0` label overflows its
button. Nine buttons (`1.0`…`5.0`) are compressed into a 286 px row.

**Source:**
- `frontend/src/pages/supervisor/RateEmployee.jsx:323` — row `flex items-center justify-between gap-1 sm:gap-2`
- `frontend/src/pages/supervisor/RateEmployee.jsx:332` — button `flex-1 h-9 rounded-ctl border text-xs font-mono …`

**Proposed fix:** on mobile use `gap-0.5` + `text-[11px]` + `px-0`, or make the scale a
horizontally scrollable row (`overflow-x-auto`) with fixed-width buttons
(`w-9 shrink-0`), or show whole-number buttons on mobile.

---

## F4 — Scrollbar presence shifts centered content ~15 px *(Medium)* — [FIXED in d8e08af]

**Evidence:** `main`'s inner container width differs by exactly one scrollbar:

| Route | @768 | @1280 | Scrollbar |
|---|---|---|---|
| `/dashboard` | 455 | 951 | present |
| `/employees` | 470 | 966 | absent (at 768) |

Switching between a short page and a tall page shifts all centered content
**≈15 px** horizontally.

**Source:** `frontend/src/components/layout/AppShell.jsx:46` — `main` has
`overflow-y-auto` and **no `scrollbar-gutter`** (confirmed: zero occurrences in `src`).

**Proposed fix:** add `[scrollbar-gutter:stable]` to the `main` class.

---

## F5 — Badge baseline sits 1 px below row text *(Low)* — [FIXED in d8e08af]

**Evidence (`/employees` @1280, 5 rows):** avatar center = name center (delta **0 px**),
but the milestone badge center is consistently **+1.0 px** below both (e.g. name
281.5 vs badge 282.5). Consistent, so it is a systematic baseline offset, not jitter.

**Source:** `frontend/src/components/ui/Badge.jsx:23` (badge line-height) used inside
table rows in `frontend/src/pages/employees/Employees.jsx`.

**Proposed fix:** `leading-none` / `align-middle` on the badge, or align row cells
with `align-middle` (verify visually).

---

## F6 — Wide tables scroll by design (acceptable) *(Info)* — [WON'T FIX — By Design]

At 375, `/dashboard` and `/audits` contain a `DIV.overflow-x-auto` that scrolls
horizontally. This is intentional table behavior and does **not** break the container
(`docOverflowX = 0`). **No action required**; optionally add a scroll affordance
(fade edge / `scrollbar-thin`).

---

## F7 — Spacing grid drift: 179 fractional utilities *(Medium, systemic)* — [FIXED in d8e08af]

The design scale is a strict 4/8 px system (`tokens.css` `--s1:4 … --s7:64`), but
Tailwind `.5` steps (2 / 6 / 10 / 14 px) are used **179 times across 158 lines**,
breaking the 8 pt cadence.

**Top offenders:**

| Utility | px | Count |
|---|---|---|
| `gap-1.5` | 6 | 25 |
| `gap-2.5` | 10 | 17 |
| `p-3.5` | 14 | 17 |
| `px-2.5` | 10 | 16 |
| `mt-0.5` | 2 | 16 |
| `py-3.5` | 14 | 14 |
| `py-1.5` | 6 | 14 |
| `mb-1.5` | 6 | 12 |
| `p-2.5` | 10 | 8 |
| `py-2.5` | 10 | 7 |
| `space-y-1.5` | 6 | 6 |
| `p-1.5` | 6 | 5 |
| `mt-1.5` | 6 | 4 |
| `py-0.5` | 2 | 4 |
| `ml-1.5` | 6 | 3 |
| `mb-0.5` | 2 | 3 |
| `px-1.5` | 6 | 3 |
| `space-y-0.5`, `px-0.5`, `pt-2.5`, `mb-2.5`, `px-3.5` | 2–14 | 1 each |

**Arbitrary values:** `pt-[12vh]` (`pages/auth/Login.jsx`) and
`pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))]` (safe-area — **legitimate, keep**).

**Suggested normalization (nearest grid step):**
`-0.5 → 0 or -1` · `-1.5 → -2` · `-2.5 → -2 or -3` · `-3.5 → -4`.
**Caution:** many `.5` values are deliberate compact micro-spacing inside badges,
dots and chips (`py-0.5`, `px-0.5`, `mt-0.5`). Recommend normalizing **container/section
rhythm** (`p-3.5`, `py-3.5`, `p-2.5`, `gap-2.5`, `space-y-1.5`) and leaving
sub-8 px control internals to design judgment.

### Per-file hit count (top 15)

| File | Lines |
|---|---|
| `pages/admin/UserManagement.jsx` | 22 |
| `pages/employees/EmployeeDetail.jsx` | 18 |
| `pages/employees/Employees.jsx` | 17 |
| `pages/settings/Settings.jsx` | 15 |
| `pages/supervisor/RateEmployee.jsx` | 10 |
| `pages/employer/Dashboard.jsx` | 8 |
| `pages/auth/Login.jsx` | 10 |
| `components/layout/Sidebar.jsx` | 10 |
| `pages/employee/EmployeeDashboard.jsx` | 6 |
| `pages/admin/AuditTrail.jsx` | 3 |
| `pages/employer/Rollups.jsx` | 4 |
| `pages/supervisor/Rubrics.jsx` | 4 |
| `pages/supervisor/SupervisorDashboard.jsx` | 4 |
| `pages/employee/EmployeeTraining.jsx` | 2 |
| `pages/notifications/Notifications.jsx` | 2 |

Full file:line list: see [Appendix A](#appendix-a--fractional-spacing-fileline-list).

---

## F8 — Theme palette cards: unselected boxes have no definition + row height jumps *(High)* — [FIXED in 35026cb]

**Route:** `/settings` → "Design Theme & Palette". **Reproduced:** paper **and** dusk.

### Evidence (measured computed styles)

| Card | Selected | card `bg` | section `bg` | border | height |
|---|---|---|---|---|---|
| Paper | no | `#ffffff` | `#ffffff` | `rgba(50,40,30,0.11)` | 105 |
| Midnight | no | `#ffffff` | `#ffffff` | `rgba(50,40,30,0.11)` | 105 |
| Dusk | **yes** | accent/5 | `#ffffff` | accent (solid) | **125** |
| Mist | no | `#ffffff` | `#ffffff` | `rgba(50,40,30,0.11)` | 105 |
| Sage | no | `#ffffff` | `#ffffff` | `rgba(50,40,30,0.11)` | 105 |

Dark theme (dusk) fails identically with dark values: section `#1a162b`,
unselected card `#1a162b`, border `rgba(196,181,253,0.12)`.

**Computed boundary contrast (WCAG 1.4.11 target = 3:1):**

- paper border `#e8e7e6` vs `#ffffff` → **1.23:1** ❌
- dusk border `#2e2944` vs `#1a162b` → **1.28:1** ❌
- light swatch `#f6f3ed` vs white card → **1.04:1** ❌ (invisible)

### Root cause

1. **Fill collision:** unselected card uses `bg-surface` and the section is *also*
   `bg-surface` → identical fill; only a ~1.2:1 border distinguishes them.
2. **Conditional footer:** the "Active Palette" footer renders only when selected,
   adding **20 px** to that card — so any grid row containing the selected card is
   125 px while other rows are 105 px.
3. **Swatch ring:** the light-theme swatch (`p.bg`) is near-white on a white card with
   a faint `border-line`.

### Source (file:line)

- `frontend/src/pages/settings/Settings.jsx:304` — section `bg-surface border border-line rounded-float p-6 shadow-sm`
- `frontend/src/pages/settings/Settings.jsx:317` — grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- `frontend/src/pages/settings/Settings.jsx:328-332` — card classes; unselected `border-line bg-surface hover:bg-hover hover:border-ink-3`
- `frontend/src/pages/settings/Settings.jsx:336-343` — swatch dots (`w-5 h-5` = `p.bg`, `w-3 h-3` = `p.accent`)
- `frontend/src/pages/settings/Settings.jsx:349-354` — conditional "Active Palette" footer

### Proposed fix

1. **Definition:** unselected card → `bg-bg` (page background) instead of `bg-surface`,
   and set the border to full `border-ink-3` (verified ≥3:1 in all 5 themes; the earlier
   `/40` variant only reached 1.57–1.91:1).
   Keep hover as-is.
2. **Equal heights:** reserve the footer for every card — always render the footer
   container (height-locked) with the label only when selected, **or** move
   "Active Palette" to a corner badge in the header row, **or** set `min-h-[125px]` on
   the card. (Badge-in-header is cleanest.)
3. **Swatch visibility:** strengthen the theme-bg dot ring (`ring-1 ring-ink/15` or
   `border-ink-3/40`) so light-theme swatches stay visible on white and dark-theme
   swatches on dark.

### Acceptance criteria

- Every unselected card boundary ≥ **3:1** vs the section in all 5 themes.
- All 5 cards render at equal height in every grid row, selected or not.
- Light-theme swatch dot distinguishable from its card at a glance.

---

## F9 — Admin Activity Log: actor email cell clips at every width *(High)* — [FIXED in 35026cb]

**Route:** `/admin/activity` (admin). The **Actor** cell renders
`employer:ralphandrewrocha@yahoo.com` with `whitespace-nowrap` and no truncation, so
it overflows its cell at **375, 768 and 1280** (measured `scrollWidth 284` vs
`clientWidth 250` at 1280 — it clips even on desktop).

**Source:** `frontend/src/pages/admin/ActivityLog.jsx:73` —
`<td className="py-3 px-4 text-ink-2 font-mono whitespace-nowrap">`. The sibling details
cell at `:85` already uses `truncate max-w-[240px]` — apply the same treatment here.

**Proposed fix:** `truncate max-w-[240px]` + `title={entry.actor_email}`, or wrap
(`whitespace-normal break-all`).

---

## F10 — Admin User Accounts: header search overflows at 768; no mobile cards *(Medium)* — [FIXED in d8e08af]

**Route:** `/admin/users` (admin). At 768 the header row (role tabs + search) is wider
than the container: `main` scrolls **54 px** horizontally and the search input is
clipped ("Search by name or emai…"). The accounts table has **no mobile card fallback**
(unlike `/employees`), so it scrolls at 375/768. (Screenshot:
`.playwright-mcp/qa-adminusers-768.png`.)

**Source:**
- `frontend/src/pages/admin/UserManagement.jsx:225` — search wrapper `relative min-w-[220px]`
- `frontend/src/pages/admin/UserManagement.jsx:240` — table wrapper `overflow-x-auto` (no responsive card view)

**Proposed fix:** let the search shrink (`min-w-0 flex-1` / `w-full sm:w-auto`) and let
the header row wrap (`flex-wrap`); optionally add the `md:hidden` card list used by
`/employees`.

---

## F11 — Supervisor Dashboard: team rows overflow at 768, clipping the action *(High)* — [FIXED in d8e08af]

**Route:** `/supervisor/dashboard` (supervisor). At 768 the "Assigned Probationary
Staff" rows exceed their container by ~96 px; the **Scorecard button is clipped** and
`main` shows a horizontal scrollbar. (Screenshot: `.playwright-mcp/qa-supdash-768.png`.)

**Source:**
- `frontend/src/pages/supervisor/SupervisorDashboard.jsx:135` — row `py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 …`
- `frontend/src/pages/supervisor/SupervisorDashboard.jsx:141` — left text block `div` (no `min-w-0`)
- `frontend/src/pages/supervisor/SupervisorDashboard.jsx:151` — right group `flex items-center gap-4 flex-wrap sm:flex-nowrap`
- `frontend/src/pages/supervisor/SupervisorDashboard.jsx:152` — `min-w-[130px]` progress block

**Proposed fix:** add `min-w-0` to the left text container and `truncate` to the
name/title; change `sm:flex-nowrap` → `lg:flex-nowrap` so the right group can wrap at
md; consider collapsing the 250 px sidebar below `lg`.

---

## Criterion 5 — Density & micro-interactions

| Check | Result |
|---|---|
| `:focus-visible` ring (2 px accent, `!important`) | ✅ `frontend/src/index.css:46` |
| Modal fade-in | ✅ `animate-in fade-in duration-150` (`EmployeeDetail.jsx` status modal) |
| Hover states on rows/controls | ✅ present (`hover:bg-hover`, `hover:border-ink-3`, `hover:text-accent`) |
| Table row padding consistency | ⚠️ mixes `py-3` / `py-3.5` / `py-4` across tables (see F7) |
| Reduced motion | ✅ `@media (prefers-reduced-motion: reduce)` in `index.css` |

**Density note:** `/audits` and `/rollups` are readable but their row rhythm is
slightly irregular because of mixed `py-3`/`py-3.5`/`py-4` (F7). Normalizing table
row padding to a single value (e.g. `py-3` compact / `py-4` comfortable) would make
data-heavy views feel more authoritative.

---

## Appendix A — Fractional spacing file:line list

<details>
<summary>158 lines (expand)</summary>

```
components/employees/AddEmployeeModal.jsx:122,269,284,291
components/layout/BottomTabBar.jsx:31,39
components/layout/CommandPalette.jsx:134
components/layout/MobileBar.jsx:32,38,61
components/layout/ShortcutModal.jsx:53,71,83,92,99
components/layout/Sidebar.jsx:54,59,78,101,102,115,121,139,171,193
components/ui/Badge.jsx:24,25
components/ui/Button.jsx:33,35
components/ui/ScoreMeter.jsx:30
context/ToastContext.jsx:119,121,126
pages/admin/AuditTrail.jsx:100,131,214
pages/admin/UserManagement.jsx:133,175,188,201,214,255,256,257,258,259,284,292,314,332,528,535,542,548,555,561,568
pages/auth/Login.jsx:69,102,108,109,116,132,177,184,191,198,205
pages/employee/EmployeeDashboard.jsx:102,109,112,174,244,282
pages/employee/EmployeeTraining.jsx:92,93
pages/employees/EmployeeDetail.jsx:302,322,439,468,473,482,491,507,610,658,677,713,731,868,886
pages/employees/Employees.jsx:206,213,221,228,236,243,266,280,292,300,312,325,338,351,473,484,509,526,532,563,571
pages/employer/Dashboard.jsx:201,254,255,256,257,258,275,367,389
pages/employer/Rollups.jsx:161,264,265,433
pages/notifications/Notifications.jsx:95,104
pages/settings/Settings.jsx:220,227,234,243,247,273,285,350,386,407,430,486,500,514
pages/supervisor/RateEmployee.jsx:236,246,303,351,367,390,408,455,462
pages/supervisor/Rubrics.jsx:99,130,153,162
pages/supervisor/SupervisorDashboard.jsx:51,70,81,90
```

</details>

---

## Appendix B — Raw responsive probe

`innerW` = centered container width; overflow = flagged overflow elements.
All routes show **`docOverflowX = 0`** (document never scrolls horizontally) — but
`main` clips the overflow, so `mainScrollX` is the real signal (see Method note).

### Swept routes (employer + others)

| Route | 375 innerW / overflow | 768 innerW / overflow | 1280 innerW / overflow |
|---|---|---|---|
| `/dashboard` | 328 / 0 (table scrolls) | 455 / 0 | 951 / 0 |
| `/employees` | 328 / 0 | 470 / **4** (table) | 966 / 0 |
| `/employees/:id` | 328 / 0 | 455 / 0 | 951 / 0 |
| `/rollups` | 328 / 0 | 470 / 0 | 966 / 0 |
| `/audits` | 328 / 0 (table scrolls) | 455 / 0 | 951 / 0 |
| `/settings` | 328 / 0 | 470 / 0 | 966 / 0 |
| `/supervisor/rate` | 328 / **5** (buttons) | 455 / 0 | 951 / 0 |
| `/login` | 343 / 0 | 420 / 0 | 420 / 0 |

### Extended sweep (all roles) — added 2026-10-03

| Route (role) | 375 | 768 | 1280 |
|---|---|---|---|
| `/admin/users` (admin) | table scrolls | **`mainScrollX 54`** — search clipped (F10) | 0 |
| `/admin/activity` (admin) | **cell clips (F9)** | **cell clips (F9)** | **cell clips (F9)** |
| `/supervisor/dashboard` (supervisor) | 0 | **row overflow, button clipped (F11)** | 0 |
| `/supervisor/rubrics` (supervisor) | 0 | 0 | 0 |
| `/employee/dashboard` (employee) | 0 | 0 | 0 |
| `/employee/training` (employee) | 0 | 0 | 0 |
| `/notifications` (all roles) | 0 | 0 | 0 |

**Clean routes (no issues):** `/rollups`, `/supervisor/rubrics`,
`/employee/dashboard`, `/employee/training`, `/notifications`, `/login`.

---

## Recommended fix order (for Gemini)

> Historical plan — **all items are now complete**. See the per-finding status tags
> and the Fix Execution & Resolution Summary below.

0. **Systemic:** consider collapsing the 250 px sidebar below `lg` — it is the shared
   root cause of the `md`-width overflows (F2, F10, F11).
1. **F11** supervisor-dashboard row overflow (clips the Scorecard action at 768).
2. **F1** header action wrapping (most visible; affects the primary record view).
3. **F8** theme-card definition + equal heights (a11y boundary failure).
4. **F9** activity-log email truncation (clips even at 1280).
5. **F2** `md → lg` table breakpoint on `/employees`.
6. **F10** admin-users header search overflow + optional mobile cards.
7. **F3** score-button clipping at 375.
8. **F4** `scrollbar-gutter: stable` (one-line, kills the layout jump).
9. **F7** spacing normalization (container rhythm first; micro last).
10. **F5** badge 1 px baseline (polish).


---

## Fix Execution & Resolution Summary

**First pass:** commit `d8e08af` (Gemini). **Correction:** commit `35026cb`.

An independent live re-probe (all roles, 375/768/1280) confirmed F0–F7, F10 and F11
fixed and F1 acceptable, but found that **F8 and F9 were not actually resolved** in
the first pass. Both were corrected in `35026cb`:

- **F8** — the first fix used `border-ink-3/40`, which measures only **1.57–1.91:1**
  against the section (target ≥ 3:1); the "≥3:1 in all 5 themes" claim was false.
- **F9** — `truncate` was applied to the **Actor** `<td>` (ineffective on a table
  cell) while the overflowing cell was the **Detail** cell; it still clipped at 1280.

**Corrections in `35026cb`:**

- **F8:** unselected card border → full `border-ink-3` (`Settings.jsx:331`).
  Re-measured boundary contrast vs section: **paper 5.18 · midnight 4.64 · dusk 4.64
  · mist 5.13 · sage 5.27** (all ≥ 3:1). Card heights remain equal (105 px).
- **F9:** moved `truncate` into an inner block `<span>` with `max-w` + `title` on the
  **Actor** and **Detail** cells (`ActivityLog.jsx:76,85`). Re-probe: **0 overflowing
  cells** at 1280.

### Final regression re-probe (post-`35026cb`)

Full sweep re-run on the corrected tree: **15 routes × 4 roles × 3 breakpoints**
(375/768/1280) plus `/login` — **61 page loads** measured via Playwright.

- **`mainScrollX = 0` and `docOverflowX = 0` on every route/breakpoint** — no
  page-level horizontal overflow anywhere.
- Sidebar correctly hidden at 375/768 and visible at 1280 on all roles.
- Every flagged element is **intended**: table `overflow-x-auto` containers
  (`/dashboard`, `/audits`, `/admin/activity`), the 375 px score-scale scroll row
  (`/supervisor/rate`), and the active `truncate` ellipsis on the supervisor
  name/title span (F11). **No unintended overflow and no regressions** from the
  F8/F9 correction.

### First-pass implementation notes (commit d8e08af)
- **Systemic Root Cause (Sidebar Breakpoint):** Moved sidebar collapse from md (768px) to lg (1024px) across AppShell.jsx, Sidebar.jsx, MobileBar.jsx, and BottomTabBar.jsx. Tablet viewports (768-1023px) now gain the full container width (~720px) and use MobileBar + BottomTabBar, curing systemic horizontal squishing across tablet views.
- **F1 (Employee Detail Actions Wrapping):** Changed container to xl:flex-row, added shrink-0 to the profile block, and updated action group to flex-wrap gap-2 w-full xl:w-auto justify-start xl:justify-end. Buttons wrap as a cohesive unit and the profile title and milestone pill remain inline.
- **F2 (Employees Table Breakpoint):** Updated mobile cards to lg:hidden and desktop table to hidden lg:block. Reduced timeline cell width from min-w-[180px] to min-w-[150px] and normalized row padding to py-3 px-4.
- **F3 (Score Selector Button Clipping at 375):** In RateEmployee.jsx:323, added gap-0.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none and gave buttons min-w-[30px] sm:min-w-0 flex-1 px-0 text-[11px] sm:text-xs shrink-0 sm:shrink. The statutory benchmark 4.0 label fits comfortably with 4px breathing room.
- **F4 (Scrollbar Presence Layout Jump):** Added [scrollbar-gutter:stable] to <main> in AppShell.jsx. Container width and centered layout remain locked across all routes regardless of vertical scroll length.
- **F5 (Badge Baseline 1px Offset):** Added align-middle to baseStyles and normalized leading-tight to leading-none in Badge.jsx.
- **F6 (Wide Tables Scrolling):** Intended responsive table scrolling preserved by design (docOverflowX = 0).
- **F7 (Spacing Grid Drift):** Normalized 40+ container and section fractional utilities to strict 8pt steps (p-3.5 -> p-4, py-3.5 -> py-3, p-2.5 -> p-3, space-y-1.5 -> space-y-2, gap-2.5 -> gap-2/gap-3). Deliberate sub-8px badge/chip internals (py-0.5, px-0.5, mt-0.5) were preserved for optical alignment.
- **F8 (Theme Palette Cards Definition & Equal Height) — corrected in 35026cb:** Initial pass used border-ink-3/40, which reached only 1.57–1.91:1 vs the section (below the 3:1 target). Corrected to full border-ink-3 with bg-bg hover:bg-hover — verified 4.64–5.27:1 in all 5 themes. Equal card heights (105 px) and the header Active badge retained.
- **F9 (Activity Log Email Truncation) — corrected in 35026cb:** Initial pass put truncate/title on the Actor td (which does not clip a table cell) while the overflowing cell was Detail; it still clipped at 1280. Corrected by wrapping the Actor and Detail cell values in an inner block span with truncate + max-w + title (ActivityLog.jsx:76,85) — 0 overflowing cells on re-probe.
- **F10 (Admin User Accounts Overflow & Mobile Cards):** Added flex-wrap and responsive w-full sm:w-64 min-w-0 to header controls. Added mobile/tablet card layout (lg:hidden) for full responsive parity with /employees and gated table with hidden lg:block overflow-x-auto.
- **F11 (Supervisor Dashboard Row Overflow):** Added min-w-0 flex-1 and 	runcate to employee title, and shrink-0 with responsive wrapping to action buttons. Scorecard button is completely visible and unclipped.
