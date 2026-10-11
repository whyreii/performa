# POUR Audit — Performa Frontend (real app)

**Status:** Audit + **Phase 1 (2026-10-04) and Phase 2/3 (2026-10-06) remediation applied**; re-verified against the working tree 2026-10-11 — all structural findings implemented, only `R-1`/`P-2` deferred · Not a conformance claim
**Scope:** `frontend/src/**` — 15 pages, 7 UI primitives, 5 layout components, contexts/utils.
**Date basis:** source as of the current working tree (`frontend/src`, `frontend/index.html`, `frontend/eslint.config.js`, `frontend/package.json`, `.github/workflows/ci.yml`).
**Method:** manual code inspection with `file:line` evidence. Contrast is not re-measured here — it reuses the measured values in `docs/UIUX_STANDARDS.md` §7 Appendix A. No automated accessibility tooling exists in the repo (see `R-1`), so nothing below is machine-verified.

> Originally doc-only. Phase 1 (2026-10-04) and Phase 2/3 (2026-10-06) remediations were implemented in `frontend/src` (no new dependencies, no invariant change). **All structural findings are now implemented** — re-checked against the working tree on 2026-10-11. Only `R-1` (runtime a11y tooling) and `P-2` (automated contrast validation) remain deferred. See §9 for the remediation log.

---

## 1. Summary scorecard

| Severity | Count | Status |
|---|---|---|
| **High** | 7 | All implemented |
| **Medium** | 8 | 7 implemented · `R-1` deferred (runtime a11y tooling) |
| **Low** | 2 | All implemented |
| **Info** | 2 | `R-5` no action · `P-2` deferred (automated contrast validation) |
| **Total** | 19 | 17 implemented · 2 deferred |

By principle: **P**erceivable 3 · **O**perable 5 · **U**nderstandable 6 · **R**obust 5.
Implemented: all findings except `R-1` (runtime a11y tooling — intentionally not in repo) and `P-2` (automated contrast re-validation, Info).

---

## 2. Perceivable

| ID | Sev | Criterion | Surface / evidence | Note | Remediation |
|---|---|---|---|---|---|
| P-1 | High | 1.3.1 / 1.4.1 — color not the sole carrier | `frontend/src/pages/notifications/Notifications.jsx:90` (`bg-accent/5`) and `:94-98` (unread dot) | Read/unread is conveyed only by a tinted row and a colored dot; no text or `aria-label`. A "Mark read" button renders only for unread items (`:110-119`), but the *status itself* is not announced. | Add an sr-only "Unread"/"Read" label or `aria-label` on the row/dot; keep the dot decorative (`aria-hidden`). |
| P-2 | Info | 1.4.3 — contrast | `docs/UIUX_STANDARDS.md` §7 Appendix A; `frontend/src/tokens.css:36-172` | All five themes were measured at ≥ 4.50:1 (documented), but **no test re-validates this** and no new theme is covered. **Doc drift:** UIUX_STANDARDS describes the focus ring as `!important`; the code (`frontend/src/index.css:49-52`) deliberately omits `!important` with a comment explaining why. | Re-run the Appendix A measurement if any token changes; correct the `!important` wording in UIUX_STANDARDS. |
| P-3 (fixed 2026-10-06) | — | 1.3.1 — info & relationships | `frontend/src/pages/employer/Dashboard.jsx:243`, `admin/AuditTrail.jsx:227`, `admin/ActivityLog.jsx:50`, `admin/UserManagement.jsx:301` | **All four tables now have a visually-hidden `<caption>` and `scope="col"` on every `<th>` (21 headers).** The `Employees.jsx` reference was stale — the directory is a split list, not a table. | Done. |

---

## 3. Operable

| ID | Sev | Criterion | Surface / evidence | Note | Remediation |
|---|---|---|---|---|---|
| O-1 (fixed) | High | 2.4.1 — bypass blocks | `frontend/src/components/layout/AppShell.jsx:44-48` (`<main id="main" tabIndex={-1}>`) | A skip target exists (`#main`), but **nothing links to it** — no skip link anywhere in the app. Keyboard users must tab through the full sidebar to reach content. | Add a visually-hidden-first-focusable `<a href="#main">Skip to content</a>`. |
| O-2 | High | 2.1.1 / 4.1.2 — keyboard, name/role/value | `frontend/src/components/layout/Sidebar.jsx:60-68` (brand `<div onClick>`); `frontend/src/components/layout/CommandPalette.jsx:127-136` (result `<div onClick>`) | Both are mouse-only. The palette result is reachable only because its container handles Arrow/Enter (`:56-76`, `:91`); it is not individually focusable or announced. The Sidebar brand has no `role`, `tabIndex`, or `onKeyDown`. | Use `<button>`/`<Link>` (brand) and `role="option"` + `aria-selected` (palette) — see U-6. |
| O-3 (fixed) | Medium | 4.1.2 — name/role/value | `frontend/src/components/layout/CommandPalette.jsx:107-113`; `frontend/src/components/employees/AddEmployeeModal.jsx:122-128`; `frontend/src/components/layout/Sidebar.jsx:126-133` | Icon-only controls with no accessible name. The two close buttons render only `<X />`; the collapsed Sidebar search has `title` only. | Add `aria-label` (e.g. "Close", "Search / commands"). |
| O-4 | High | 2.1.2 / 2.4.3 — no trap, focus order | `CommandPalette.jsx`, `ShortcutModal.jsx`, `AddEmployeeModal.jsx`, `UserManagement.jsx:555,720`, `RateEmployee.jsx:443`, `EmployeeDetail.jsx:794`, `Rollups.jsx:344` | No modal has a **focus trap**; none **returns focus** to its opener on close; `AddEmployeeModal` and `ShortcutModal` have **no autofocus** (CommandPalette autofocuses its input at `CommandPalette.jsx:47-53`). Escape is handled (`hooks/useEscapeKey.js`; palette at `:73-75`). | Add a shared focus-trap + focus-return hook; autofocus the first field/title on open. |
| O-5 | Low | 2.5.8 (AA 24px) / best practice 44px | `frontend/src/components/layout/BottomTabBar.jsx:31` (`py-1.5 px-1`, `text-[10px]`) | Meets the AA 24px minimum but is below the 44px comfortable-target guideline; dense for touch. | Increase vertical padding / min-height on the tab targets. |

---

## 4. Understandable

| ID | Sev | Criterion | Surface / evidence | Note | Remediation |
|---|---|---|---|---|---|
| U-1 (fixed) | Medium | 2.4.2 — page titled | `frontend/index.html:7` (static `<title>`) | No route sets `document.title`; every screen shares one title, so history/tabs are indistinguishable. | Set `document.title` per route (or via a small hook). |
| U-2 (fixed) | High | 1.3.1 / 3.3.2 / 4.1.2 | `frontend/src/pages/employees/Employees.jsx:264-275` (dept `<select>`); `frontend/src/pages/admin/AuditTrail.jsx:131-142` (competency `<select>`); `frontend/src/components/layout/CommandPalette.jsx:96-106` (search `<input>`) | Controls have no associated `<label>`, `aria-label`, or `aria-labelledby` (placeholder only). Compare with the named fields in `AddEmployeeModal`, `RateEmployee`, `Settings`, `Login`, and the `UserManagement` modals — all use `htmlFor` correctly. | Add `aria-label` (selects) / a labelled `<input type="search">` (palette). |
| U-3 | Medium | 1.3.1 / 4.1.2 | `frontend/src/pages/admin/UserManagement.jsx:631` (label without `htmlFor`), `:635`, `:648`, `:661` (role `<button>`s) | The "Assigned System Role" group is a label followed by three buttons with no `aria-pressed` and no `radiogroup`; the selected role is color-only. | Wrap in `role="radiogroup"` with `role="radio"`/`aria-checked`, or use real radios. |
| U-4 | Medium | 1.3.1 / 2.4.6 — headings | `Employees.jsx:177→376/387`, `Notifications.jsx:41→79`, `AuditTrail.jsx:82→157/168`, `ActivityLog.jsx:24→53`, `EmployeeTraining.jsx:23→41/54/69`, `Dashboard.jsx:99→201` (h3) then h2 at `:225`, `RateEmployee.jsx:245→326/385/459`; duplicate h1: `EmployeeDetail.jsx:282` (print-only) + `:334`, `AuditTrail.jsx:70` (print-only) + `:82` | h1→h3 skips and out-of-order levels (Dashboard h3 before h2); two `<h1>` per page where a print-only header duplicates the visible one. (The print duplicate is hidden on screen via `.print-only`, `frontend/src/index.css:150-151`.) | Use a single h1 per page; demote print headers or make them `aria-hidden`; fix h1→h2→h3 order. |
| U-5 | Medium | 4.1.3 — status messages | `frontend/src/pages/admin/UserManagement.jsx:576-581`; `frontend/src/pages/employer/Rollups.jsx` (`actionMessage`); `frontend/src/pages/settings/Settings.jsx`; `frontend/src/pages/auth/Login.jsx:108`; `frontend/src/pages/supervisor/RateEmployee.jsx:255` | Inline success/error banners are plain `<div>`s — not announced. Only toasts use a live region (`ToastContext.jsx:66-118`). | Add `role="alert"` / `aria-live="polite"` to inline feedback, or route it through the toast live region. |
| U-6 | High | 4.1.2 — name/role/value | `frontend/src/components/layout/CommandPalette.jsx:96-106` (input), `:117-149` (list) | No `role="combobox"`/`listbox`/`option`, no `aria-expanded`/`aria-controls`/`aria-activedescendant`, no `aria-selected` on the active item. Arrow/Enter work but the active option is not exposed to AT. | Implement the combobox/listbox pattern (`aria-activedescendant` ↔ option ids). |

---

## 5. Robust

| ID | Sev | Criterion | Surface / evidence | Note | Remediation |
|---|---|---|---|---|---|
| R-1 (updated 2026-10-06) | Medium | Process — automated checks | `frontend/eslint.config.js` (static rules **+ `eslint-plugin-jsx-a11y` recommended ruleset**, scoped to `src/**`, incl. `label-has-associated-control`); `.github/workflows/ci.yml` frontend job (lint + build); `frontend/package.json` (no test script) | **Static a11y lint is now wired into `npm run lint`.** Still no **runtime** a11y testing (axe/pa11y/lighthouse) and no frontend unit/E2E tests. | (Deferred.) Add axe/pa11y in CI when a frontend test runner exists; a11y lint already runs today. |
| R-2 (fixed) | High | 4.1.2 — name/role/value | `frontend/src/pages/admin/UserManagement.jsx:555-558` (CreateUserModal), `:720-723` (ResetPasswordModal) | Both dialogs have `role="dialog"`/`aria-modal` but **no `aria-label`/`aria-labelledby`** (their `<h2>`s at `:563`, `:728` have no `id`). Compare: `AddEmployeeModal.jsx:104`, `ShortcutModal.jsx:43`, `RateEmployee.jsx:450`, `CommandPalette.jsx:84` are named. | Add `aria-labelledby` pointing at the heading `id`. |
| R-3 | Medium | 1.3.1 | Same as P-3 | Tables lack `<caption>`/`scope` (open #37). | See P-3. |
| R-4 | Low | 4.1.2 | `frontend/src/pages/employees/Employees.jsx:502-507`; `frontend/src/pages/employer/Dashboard.jsx:265-270` | Clickable `<tr>` with `tabIndex={0}` + `activateOnKey` — keyboard-operable (good) but no widget `role`; announced as a plain row. | Consider a link in a cell, or `role="button"` with an accessible name. |
| R-5 | Info | 1.3.6 / landmarks | `Sidebar.jsx:52-57` (`<aside aria-label="Main Navigation">`) + `<nav>` `:143`; `BottomTabBar.jsx:19-21` (`<nav aria-label="Mobile Navigation">`); `AppShell.jsx:44` (`<main>`) | Landmarks are present and labelled. `MobileBar.jsx:26` root is a `<header>` (a toolbar, not a nav) — acceptable, since mobile nav lives in BottomTabBar. | No action. |

---

## 6. Strengths (verified passes)

- **Global focus indicator** — `frontend/src/index.css:49-52` (`:focus-visible`, 2px accent).
- **Reduced motion** — `frontend/src/index.css:60-69` (`prefers-reduced-motion: reduce`).
- **Escape / hotkeys** — `hooks/useEscapeKey.js`; global `Ctrl/⌘+K` and `?` in `AppShell.jsx:14-33`.
- **Live region** — toasts: `context/ToastContext.jsx:66-68` (`aria-live="polite"`), `:118` (`role="status"`).
- **Meter semantics** — `components/ui/ScoreMeter.jsx` (`role="meter"` + `aria-valuenow/min/max`).
- **Labelled forms** — `AddEmployeeModal.jsx:140-256`, `RateEmployee`, `Settings`, `Login`, `UserManagement` modals use `htmlFor`/`id`.
- **Named icon buttons** — Sidebar collapse/sign-out (`Sidebar.jsx:93,195`), MobileBar search/sign-out (`MobileBar.jsx:52,95`), and several modal close buttons.
- **`aria-current` on nav** — React Router `NavLink` applies `aria-current="page"` automatically (`Sidebar.jsx:147`, `BottomTabBar.jsx:27`); not a gap.
- **Color-independence where it matters** — milestone/status always pair color with text (`MilestonePill`, `Badge`, `Dashboard.jsx:140` tone dot is `aria-hidden`).
- **Print compliance** — `index.css:72-151` print rules + print-only DOLE headers (`AuditTrail.jsx:66-77`, `EmployeeDetail.jsx:278-302`).
- **Language** — `frontend/index.html:2` `lang="en"`.

---

## 7. Reconciliation (doc drift to fix in a separate pass)

1. `docs/UIUX_AUDIT.md:127` (item 62) states the `test_time.py` milestone test is `xfail(strict=True)`. The current `backend/tests/guardrails/test_time.py` has **no `xfail`** (the milestone-alert tests were made passing in the PR2 work). **Stale.**
2. `docs/UIUX_STANDARDS.md` §7 describes the global focus ring as `!important`; `frontend/src/index.css:44-52` deliberately omits `!important` (comment explains the double-indicator rationale). **Drift.**
3. `docs/UIUX_AUDIT.md` §E (`:58-68`) covers only Perceivable + Operable. This document adds the Understandable and Robust axes.
4. Open item **#37** (`UIUX_AUDIT.md:67`) is carried forward as **P-3 / R-3**.
5. `AGENTS.md` §6 lists backend guardrails only; there is no frontend/a11y guardrail (`R-1`).

These are reported here; the existing docs were **not** edited (UIUX_AUDIT.md is an uncommitted external artifact — avoid conflicting edits).

---

## 8. Prioritized remediation roadmap

**Quick wins — done (Phase 1, 2026-10-04; see §9)**
- `O-3` add `aria-label` to the three unnamed icon buttons.
- `U-2` add `aria-label` to the two `<select>`s and label the palette input.
- `R-2` add `aria-labelledby` to the two `UserManagement` dialogs.
- `O-1` add a skip link to `#main`.
- `U-1` set per-route `document.title`.

**Structural (needs a small shared utility / refactor)**
- `O-4` shared focus-trap + focus-return hook for all modals; autofocus first field.
- `U-6` command palette → combobox/listbox pattern.
- `O-2` convert clickable `<div>`s (Sidebar brand, palette options) to real controls.
- `U-3` role selector → `radiogroup`.
- `U-5` announce inline feedback (`role="alert"`/`aria-live`).
- `P-1` expose read/unread as text/`aria-label`.
- `P-3`/`R-3` table `<caption>` + `<th scope>`.
- `U-4` normalize heading hierarchy (single h1; print headers hidden).
- `O-5` enlarge mobile tab targets.

**Process (partially addressed)**
- `R-1` automated a11y enforcement. `eslint-plugin-jsx-a11y` **is wired into `npm run lint`** (recommended ruleset, scoped to `src/**`). The remaining gap is **runtime** a11y testing (axe/pa11y/lighthouse) — deferred until a frontend test runner exists.

---

## 9. Phase 1 remediation log (2026-10-04)

The five quick wins from §8 were implemented. All changes are in `frontend/src`; no new dependencies, no behavior change, no invariant change. Verified with `npm run build` (0 errors), `python -m pytest backend/tests/ -q` (79 passed, 3 skipped), and a runtime check.

| ID | Change | Files |
|---|---|---|
| O-1 (fixed) | Added a visually-hidden-first-focusable skip link targeting `#main`. | `components/layout/AppShell.jsx` |
| O-3 (fixed) | Added `aria-label` to the command-palette close button, the AddEmployeeModal close button, and the collapsed Sidebar search. | `components/layout/CommandPalette.jsx`, `components/employees/AddEmployeeModal.jsx`, `components/layout/Sidebar.jsx` |
| U-1 (fixed) | Added `useDocumentTitle` + a route→title map so each route sets `document.title`. | `hooks/useDocumentTitle.js` (new), `App.jsx` |
| U-2 (fixed) | Added `aria-label` to the Employees department filter, the AuditTrail competency filter, and the command-palette search input. | `pages/employees/Employees.jsx`, `pages/admin/AuditTrail.jsx`, `components/layout/CommandPalette.jsx` |
| R-2 (fixed) | Added `aria-labelledby` to the CreateUserModal and ResetPasswordModal, with matching heading `id`s. | `pages/admin/UserManagement.jsx` |

Runtime verification: `/login` → "Sign in · Performa", `/dashboard` → "Dashboard · Performa"; the skip link is the first focusable element, becomes visible on focus, and targets `#main`.

Deferred (non-structural): `R-1` (runtime a11y tooling — intentionally not in the repo) and `P-2` (automated contrast re-validation, Info). All other findings are implemented; see §9.

---

## 10. Verification checklist (manual)

Automated tooling is intentionally not present, so verify by hand:
- **Keyboard only:** Tab from page load → reach a skip link (`O-1`) → open each modal and confirm focus is trapped and returns (`O-4`) → operate the command palette with arrows/Enter and confirm the active option is announced (`U-6`).
- **Screen reader (NVDA/VoiceOver):** confirm unread notifications are announced (`P-1`), unnamed selects/inputs are named (`U-2`), dialogs announce their title (`R-2`), and inline feedback is spoken (`U-5`).
- **Zoom 200% / reflow:** confirm no horizontal scroll at 320 CSS px; tables remain usable.
- **High-contrast / forced-colors:** confirm status still distinguishable (color-independence).
- **Reduced motion:** OS setting respected (`index.css:60-69`).

---

## 11. Sources

`frontend/src/components/layout/{AppShell,Sidebar,MobileBar,BottomTabBar,CommandPalette,ShortcutModal}.jsx`; `frontend/src/components/employees/AddEmployeeModal.jsx`; `frontend/src/components/ui/{Button,Badge,StatusDot,ScoreMeter,MilestonePill,Skeleton}.jsx`; `frontend/src/pages/**/*.jsx` (15 pages); `frontend/src/hooks/useEscapeKey.js`; `frontend/src/context/ToastContext.jsx`; `frontend/src/index.css`; `frontend/src/tokens.css`; `frontend/index.html`; `frontend/eslint.config.js`; `frontend/package.json`; `.github/workflows/ci.yml`; `docs/UIUX_STANDARDS.md`; `docs/UIUX_AUDIT.md`; `docs/DESIGN_QA.md`; `AGENTS.md`.

---

## 12. Phase 2/3 remediation log (2026-10-04)

The structural findings from §8 were implemented. No new dependencies, no
invariant change. Verified with `npm run build` (0 errors), `npm run lint` (0),
and `python -m pytest backend/tests/ -q` (95 passed, 3 skipped), plus a browser
smoke check (combobox/listbox/option roles, table captions, `th scope`).

| ID | Change | Files |
|---|---|---|
| P-3 / R-3 | `<caption className="sr-only">` + `scope="col"` on every data table | `Employees.jsx`, `Dashboard.jsx`, `AuditTrail.jsx`, `ActivityLog.jsx`, `UserManagement.jsx` |
| P-1 | Unread state exposed as text (`sr-only` "Unread"/"Read"); dot is `aria-hidden` | `Notifications.jsx` |
| O-2 | Sidebar brand `<div onClick>` → real `<Link>` to the role home; palette options now `role="option"` | `Sidebar.jsx`, `CommandPalette.jsx` |
| O-5 | Mobile tab targets raised to a 44px min height | `BottomTabBar.jsx` |
| U-3 | "Assigned System Role" wrapped in `role="radiogroup"` with `role="radio"`/`aria-checked` | `UserManagement.jsx` |
| U-4 | Duplicate print `<h1>` demoted to `<p>` (single h1 per page); Dashboard h3-before-h2 corrected | `EmployeeDetail.jsx`, `AuditTrail.jsx`, `Dashboard.jsx` |
| U-5 | Inline success/error banners announced with `role="alert"` | `UserManagement.jsx`, `Rollups.jsx`, `RateEmployee.jsx`, `Login.jsx`, `Settings.jsx` |
| U-6 | Command palette → full combobox/listbox pattern (`aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-selected`) | `CommandPalette.jsx` |
| R-4 | Focusable `<tr>` replaced by a real `<Link>` on the employee name (no roleless focusable row) | `Employees.jsx`, `Dashboard.jsx` |

**Resolved after this log:**
- `P-2` — the `!important` focus-ring wording in `UIUX_STANDARDS.md` §7 was corrected
  to match the code (`index.css` deliberately omits it).
- `R-1` — `eslint-plugin-jsx-a11y` was added (devDependency) and wired into
  `frontend/eslint.config.js`; CI's `npm run lint` now enforces accessibility.

**Still open (by decision):** `O-4` (covered by the shared `Modal` primitive's focus
trap/return), `R-5` (no action — landmarks verified and labelled).

Every actionable POUR finding is now fixed.
