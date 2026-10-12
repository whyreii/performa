# AI-Slop / Vibe-Code Audit — Performa frontend

**Status:** Read-only audit + revamp plan · **Not yet applied**
**Scope:** `frontend/src/**` (45 files: 15 pages, 7 UI primitives, 5 layout components, contexts/utils)
**Method:** static scan (occurrence counts + `file:line` examples). No code changed.

> This is the frontend-wide analogue of `docs/archive/POUR_AUDIT.md`. It inventories the "AI slop / vibe-coded" tells and proposes a systematic revamp toward the settled foundation (Ledger skeleton · accent = identity only · colour = status · wordmark-only).

---

## 1. What "slop" means here (the rules)

From the de-vibe work:
1. No gratuitous cards.
2. No rounded + shadow everywhere.
3. No uppercase micro-labels.
4. No badge spam.
5. Numbers/dates/IDs use tabular figures (`--num` / `font-num`).
6. One encoder per value (don't show status as dot + colour + badge + text).
7. No icon-on-heading.
8. Accent = identity only; colour carries status.
9. Type is **Inter** — one family for UI and for numbers/dates/scores/IDs (`--num` / `font-num`, tabular figures). No second family, no serif. (Owner decision: a single family, not the platform system face.)
10. One page wrapper. Every routed page renders `Page` (`components/ui/Page.jsx`); the per-page vertical rhythm (24px) + fade-in live there. The max-width/padding "gallery wall" lives **once** in `AppShell.jsx` — `Page` never declares it (no double grid). Direct children of `Page` must **not** add their own `mt-*`/`pt-*` — the 24px gap is owned solely by `Page` (a top-level row that pads itself drifts off the wall). **No page may escape the wall**: `frontend/src/index.css` must not contain `main:has(...)` (or a page-scoped `max-width: none`) full-bleed override — enforced by `test_page_wrapper.py::test_no_page_escapes_the_gallery_wall`.
11. The frame never moves. A card/list that loads asynchronously renders `CardSkeleton` (or a skeleton **inside** the real `Card`) with stubs sized to the loaded content, so the surface/height is reserved and nothing shifts when data arrives.
12. Motion easing: use `--ease` for color/opacity transitions; use the `.ease-spring` utility (guarded by `@supports`, falls back to `--ease`) **only** for transform/position transitions — never on color.
13. Icons come from `src/components/icons.js` **only** (Phosphor, MIT — SF-Symbols-inspired). No direct `lucide-react` / `@phosphor-icons/react` imports (enforced by `eslint.config.js` `no-restricted-imports`). Pass `weight="fill"` for active/selected states.

---

## 2. Findings — counts across `frontend/src`

| Tell | Total | Files | Worst offender |
|---|---|---|---|
| `text-[11px]` / `[10px]` / `[9px]` (raw px, bypasses the 5-step scale) | **90** | 22 | UserManagement (14), EmployeeDetail (8) |
| `border border-line` (every container bordered) | **151** | 25 | Settings (19), EmployeeDetail (18) |
| `bg-hover` (boxed-tile fill) | **81** | 24 | EmployeeDetail (11), UserManagement (9) |
| boxed-tile co-occurrence (`bg-hover … border border-line`) | **34** | 14 | EmployeeDetail (8), Settings (7), EmployeeDashboard (7) |
| `rounded-float` (card radius) | **55** | 20 | EmployeeDetail (9) |
| `shadow-sm` | **51** | 20 | EmployeeDetail (7), Dashboard (6) |
| `<Badge` | **46** | 13 | EmployeeDetail (7), MilestonePill (7) |
| `font-mono` | **117** | 23 | UserManagement (17) |
| `uppercase` / `tracking-` (micro-label kickers) | **22 / 42** | 14 / 18 | Settings (4/5), AuditTrail (4/5) |
| card-everything (`bg-surface … rounded-float`) | **49** | 19 | EmployeeDetail (9), Rollups (7) |
| `backdrop-blur` | 11 | 10 | — |
| custom focus (`focus:outline-none focus:border-accent`) | 27 | 9 | AddEmployeeModal (6) |

**Headline:** the design system defines exactly five type sizes (`tokens.css:8-13`), yet there are **90 raw pixel font sizes** in the pages. And every surface is `border + shadow + rounded`.

---

## 3. The systemic causes (not one-off mistakes)

These are the root reasons the counts are high — fix these and the counts collapse:

1. **No shared primitives.** `components/ui/` has only `Button`, `Badge`, `StatusDot`, `ScoreMeter`, `MilestonePill`, `Skeleton`. There is **no `Card`, `Modal`, `Field/Input`, `EmptyState`, `StatCard`, or `Tabs`.** So every page hand-rolls them:
   - modal shell duplicated **7×** (`AddEmployeeModal.jsx:101`, `UserManagement.jsx:555,721`, `EmployeeDetail.jsx:793`, `RateEmployee.jsx:443`, `Rollups.jsx:344`, `ShortcutModal.jsx:40`, `CommandPalette.jsx:81`);
   - empty state duplicated **10×** (`Employees.jsx:386`, `AuditTrail.jsx:166`, `ActivityLog.jsx:50`, `Notifications.jsx:76`, `Rollups.jsx:203`, `EmployeeTraining.jsx:49`, `SupervisorDashboard.jsx:122`, …);
   - card container duplicated **49×**;
   - input class literal duplicated **27×** across 9 files;
   - colored progress bar duplicated **5×** (`EmployeeDetail.jsx:462`, `EmployeeDashboard.jsx:130`, `Dashboard.jsx:296`, `Employees.jsx:446,546`, `SupervisorDashboard.jsx:158`);
   - KPI/stat card markup repeated (`Dashboard.jsx:127`, `SupervisorDashboard.jsx:71`, `UserManagement.jsx:148`).
2. **The type scale is bypassed.** Raw `text-[11px]`/`[10px]` everywhere instead of `text-12/14/16/22/30`.
3. **Import inconsistency.** `Login.jsx` imports **no** ui primitives (hand-rolls its button); `UserManagement.jsx` bypasses the barrel and imports files directly; `Rubrics.jsx:161` hand-rolls a badge; `Dashboard.jsx:139` hand-rolls a dot.

---

## 4. Anti-patterns with evidence

- **Icon-on-heading** (remove): `EmployeeDetail.jsx:446,510,571,613,717` (five h2s), `EmployeeDashboard.jsx:171`, `Dashboard.jsx:333`, `Rollups.jsx:356`, `Settings.jsx:169,276,334,410`, `AddEmployeeModal.jsx:113`, `ShortcutModal.jsx:53`, `RateEmployee.jsx:454`.
- **Boxed stat tiles** (convert to ledger/definition rows): `EmployeeDetail.jsx:478-502`, `EmployeeDashboard.jsx:145-163`, `Settings.jsx:191-226`, `Dashboard.jsx:363`, `RateEmployee.jsx:291`, `AddEmployeeModal.jsx:261`.
- **Badge spam** (cap / replace with tone text): `Rollups.jsx:222-228`, `EmployeeTraining.jsx:68-88`, `EmployeeDetail.jsx:656-663`, `Settings.jsx:316-321`, `Rubrics.jsx:132-146`, `EmployeeDashboard.jsx:247-254`.
- **Uppercase micro-labels** (drop the styling): `Settings.jsx:193,200,207,216`, `EmployeeDashboard.jsx:103`, `RateEmployee.jsx:323`, `UserManagement.jsx:108`, `Rubrics.jsx:111`, `AuditTrail.jsx:105`, `Employees.jsx:294`.
- **Redundant status encodings** (pick one): `Dashboard.jsx:137-156` (dot + colour + label), `UserManagement.jsx:416-425` + `:289-301` (dot + colour), `Employees.jsx:431-435,535-539` (dot + text), `Dashboard.jsx:290-315` / `Employees.jsx:541-569` / `SupervisorDashboard.jsx:158-168` (progress bar **and** `MilestonePill` for the same value).

---

## 5. Revamp plan

### Phase 0 — Preservation (do not violate)
The de-slop pass may change the *styling* of XAI/legal copy but must **never delete or reword** the protected strings: the XAI terms (AGENTS §1.4 / `UIUX_AUDIT.md` §B items 13–15) and the legal anchors (e.g., `AuditTrail.jsx` "Statutory Legal Standard", `Rubrics.jsx` legal banner). Enforced by `backend/tests/guardrails/test_xai_copy.py`.

### Phase A — Foundations (unblocks everything)
Add missing primitives in `components/ui/`: `Card` (hairline, no shadow by default), `Modal` (shell + focus trap + focus return + `aria-labelledby`), `Field`/`Input` (one class literal), `EmptyState`, `StatRow` (label/value, no box), `Tabs`. Export via the barrel; migrate the 7 modal shells, 10 empty states, 27 input literals, 49 card containers, 5 progress bars.

### Phase B — Typography sweep
Replace every `text-[11px]`/`[10px]`/`[9px]` with a scale token (`text-12`). Mono stays only for numbers/dates/IDs/scores. (Removes ~90 violations.)

### Phase C — Container/card sweep
One card style (hairline, no `shadow-sm`). Delete the shadow from every card. Convert boxed key/value tiles → `StatRow` / definition rows. Target: `shadow-sm` 51 → ~0 on cards; boxed-tile co-occurrence 34 → 0.

### Phase D — Status/badge sweep
One encoder per value. Cap badges to ≤1 per row; replace the rest with tone text. Collapse the duplicated progress-bar + `MilestonePill` pairs.

### Phase E — Icon & kicker sweep
Remove icons from headings. Drop `uppercase tracking-wider` micro-labels (use plain 12px `ink-3`).

### Phase F — Per-file hotspot passes
In hotspot order (see §6): EmployeeDetail, UserManagement, Settings, EmployeeDashboard, RateEmployee, AuditTrail, Dashboard, Rollups. Each pass: typography, containers, status, icons, and adopt the new primitives.

### Phase G — Guardrail
Extend `frontend/eslint.config.js` `no-restricted-syntax` (no new dependency) to ban:
- arbitrary text sizes (`JSXAttribute[name.name='className'][value.value=/text-\[/]`),
- `shadow-sm` on card containers (or ban it outright outside `ui/`),
- `uppercase tracking-` micro-labels.
Wire into `npm run lint` (already in CI).

---

## 6. Priority order (by hotspot score)

| # | File | Score | 
|---|---|---|
| 1 | `pages/employees/EmployeeDetail.jsx` | 38 |
| 2 | `pages/admin/UserManagement.jsx` | 30 |
| 3 | `pages/settings/Settings.jsx` | 29 |
| 4 | `pages/employee/EmployeeDashboard.jsx` | 24 |
| 5 | `pages/supervisor/RateEmployee.jsx` | 19 |
| 6 | `pages/admin/AuditTrail.jsx` | 18 |
| 7 | `pages/employer/Dashboard.jsx` | 17 |
| 8 | `pages/employer/Rollups.jsx` | 17 |
| 9 | `pages/employee/EmployeeTraining.jsx` | 11 |
| 10 | `pages/employees/Employees.jsx` | 11 |

Score = `shadow-sm` + `rounded-float` + `<Badge` + `uppercase` + `text-[11px]` + `text-[10px]` + `bg-hover border`.

---

## 7. Related work

- **Tracker** — the `EmployeeDetail` progress-bar + boxed-tile pattern is already redesigned (least-slop) in the sandbox: `performa-minimal/t5b-tracker.html` (lean variant = scale + milestone ledger, no boxes/dots). Apply as part of Phase C/F on EmployeeDetail.
- **Voice** — the settled direction (accent = identity, colour = status, wordmark-only) is prototyped in `performa-minimal/voices.html`.

---

## 8. Verification

- `cd frontend && npm run build` → 0 errors.
- `python -m pytest backend/tests/ -q` → 79 passed, 3 skipped.
- Re-run the §2 counts after each phase; target: raw px sizes 90 → 0, boxed-tile co-occurrence 34 → 0, card `shadow-sm` 51 → 0.
- Manual: confirm no regression in the DOLE print views and the XAI terms remain visible (invariant §1.4).

---

## 9. Applied so far (2026-10-04)

**Phase A — primitives added** (`frontend/src/components/ui/`, exported via the barrel):
`Card` (hairline, no shadow) · `Modal` (Escape + focus trap + focus return + `aria-labelledby`) · `Field` + `inputClass`/`textareaClass` · `EmptyState` · `StatRow` · `Tabs`.

**EmployeeDetail pilot** (`pages/employees/EmployeeDetail.jsx`):
- All 7 sections converted from `<section class="… shadow-sm">` → `<Card>` → **cards with a shadow: 7 → 0**.
- Heading icons removed (**5 → 0**).
- Tracker rebuilt as the lean deadline scale (hairline scale + milestone ledger, no boxes); **adds the missing Day 178 · Critical**.
- Boxed scorecard tiles → hairline ledger rows; boxed rationale → plain text; competency badge → plain text.
- Audit empty state → `EmptyState`; status modal → `Modal` primitive.
- Print-only `text-[11px]` intentionally kept (document/print surface, not screen UI).

Verified: `npm run build` 0 errors; `pytest` 79 passed, 3 skipped; runtime — 7 Cards / 0 with shadow, 0 heading icons, XAI terms intact (Random Forest / Gemini / Feature importance), modal opens with focus inside and closes on Escape.

**XAI copy restored (2026-10-04):** the t3/pilot truncation of `UIUX_AUDIT.md` §B item 15 was reverted — `EmployeeDetail.jsx` again reads "ML Risk Explanation" / "Feature importance for legal defensibility". Guarded by `backend/tests/guardrails/test_xai_copy.py` (Tier 1 terms + Tier 2 preserved phrasing; see §5 Phase 0).

**Phase B — typography sweep (2026-10-04):** every raw pixel size removed across `frontend/src` — `text-[11px]` (71), `text-[10px]` (15), `text-[9px]` (1) → `text-12` (the Scale B floor). 23 files. Raw px sizes: **87 → 0**.

**Phase C — container sweep (2026-10-04):** all `rounded-float` card shadows removed (`shadow-sm` on cards: **28 → 0**, 14 files). Boxed key/value tiles converted to hairline ledger rows in Settings (profile), EmployeeDashboard (milestones + competency), Dashboard (AI recommendations), and RateEmployee (selector summary). Notice/control boxes (legal notices, alert-protocol rows) intentionally kept. `Card` primitive adopted in EmployeeDetail.

**Phase D — status/badge sweep (2026-10-04):** collapsed redundant status encoders to **one per value** — Dashboard KPI dot removed (tone number kept); RateEmployee score badge → tone number + target caption; Rollups / EmployeeTraining / Settings / Rubrics multi-badge rows → text; UserManagement + Employees `StatusDot` + text → tone text; EmployeeDashboard audit badge → text; milestone progress bars made **neutral** so `MilestonePill` is the single status encoder. Also removed the KPI-card `shadow-sm` Phase C missed (6 cards, Dashboard/SupervisorDashboard).

**Phase E — icons & kickers (2026-10-04):** removed decorative heading icons / icon tiles (Dashboard h2, Rollups modal h3, AddEmployeeModal, Settings ×4, RateEmployee modal); brand tiles kept (Sidebar/Login). Dropped `uppercase tracking-wider` on screen kickers (CommandPalette, Sidebar, AuditTrail, UserManagement, EmployeeDashboard, EmployeeTraining, Employees, Rollups, RateEmployee, Rubrics). Table headers kept uppercase (decision) and print/legal document headers untouched. Dead imports removed. Counts: `uppercase` **23 → 8** (all table/print), icon-on-heading → **0**, icon tiles → **2** (brand only).
- **Follow-up pass (2026-10-04):** the first sweep's pattern missed `p-*`-style icon tiles. Removed the **ShortcutModal heading icon tile**, plus other decorative icons: SupervisorDashboard KPI cards (`Users`/`Target`/`Calendar`), ShortcutModal group-title icons, AddEmployeeModal banner `Calendar`, and the Employees "Milestone Triage" `Clock`. Remaining `rounded-*` icon containers are brand logos, initials avatars, and empty/success-state icons only.
- **Completion pass (2026-10-04):** removed the remaining decorative **label/banner icons** — `ShieldCheck` on the AuditTrail + Rubrics legal banners, the 4 Settings protocol rows + "System Active", the UserManagement kicker, the AddEmployeeModal password label, and the AuditTrail "Append-only" cell; `Sparkles` on the Rollups/EmployeeTraining rationale labels; `ShieldAlert` on the Dashboard milestone banner; and the Employees milestone-filter pill icons. Only **functional** icons (search / chevrons / arrows / logout / input adornments / info), **error/empty-state** icons, and **brand** logos remain. Dead imports removed.

**Phase F — primitives & consolidation (2026-10-04):** adopted the shared primitives across the hotspot files and deleted the duplicated markup.
- **Modals (7 → `Modal`):** AddEmployeeModal, RateEmployee, Rollups, UserManagement ×2, ShortcutModal, CommandPalette — only `Modal.jsx` defines `role="dialog"` now.
- **Tabs (2 → `Tabs`).**
- **Empty states (7 → `EmptyState`):** Notifications, AuditTrail, ActivityLog, Employees, SupervisorDashboard, Rollups, EmployeeTraining — icon-circles removed, action slots added. Error states kept distinct.
- **Inputs (15 → `TextField`):** Login, AddEmployeeModal, Settings, UserManagement. The remaining raw controls use the shared classes — search → `${inputClass} pl-9`, select → `${selectClass}`, textarea → `${textareaClass}` (standardization pass 2026-10-04). **Last two literals migrated 2026-10-06** (AddEmployeeModal select, RateEmployee textarea); no duplicated form-control literals remain.
- **Cards (→ `Card`):** EmployeeDetail, EmployeeDashboard, Settings, SupervisorDashboard, ActivityLog, Notifications, AuditTrail, UserManagement, Dashboard, RateEmployee, Rubrics, Rollups, EmployeeTraining, Employees. 11 containers remain (error states, auth card, milestone banner) — intentionally kept.
- Counts: `<Card>` 7 → 31 · `<Modal>` 1 → 8 · `<EmptyState>` 1 → 8 · `<Tabs>` 0 → 2 · `<TextField>` 0 → 15 · input literals 28 → **0** (form controls; verified 2026-10-06) · `role="dialog"` 8 → 1.

**Phase G — eslint guardrail (2026-10-04):** added three `no-restricted-syntax` selectors to `frontend/eslint.config.js` (no new dependency; runs in the existing `npm run lint` CI step): (1) no arbitrary `text-[…px]`; (2) no `shadow-sm` on `rounded-float` cards; (3) no `uppercase` micro-label kickers on `span`/`div` (table + print/legal headers stay allowed). Verified: `npm run lint` is clean on the tree, and **prove-it-bites** (a scratch file with the banned patterns fails lint while the allowed patterns pass).

**Page wrapper (2026-10-04):** added `components/ui/Page.jsx` and migrated all 14 routed pages off the hand-copied `space-y-6 animate-in fade-in duration-150` root div (12 plain pages + `AuditTrail` via `aboveHeader` for its print-only DOLE header + `EmployeeDetail` via `printSheet header={false}`). `Page` owns rhythm + fade + optional `PageHeader`; it declares **no** max-width/padding — the grid stays once in `AppShell.jsx:79`, which wraps both the content and the `PageSkeleton` fallback. Net DOM nodes added: 0. Guarded by `backend/tests/guardrails/test_page_wrapper.py` (no page hand-rolls the wrapper; every page uses `<Page>`; `Page` defines no grid).

**Standardization pass (2026-10-04):** three parts that bypassed the shared primitives.
- **Theme palette single source** — added `frontend/src/config/themes.js` (`PALETTES` + ids/modes/bg); `ThemeContext`, `Login`, `MobileBar`, `Settings`, `CommandPalette` now import it (was duplicated in 5 files). Fixed the drifted swatch accents: Midnight `#3b82f6` → `#60a5fa`, Dusk `#9368f7` → `#a78bfa`. Guarded by `backend/tests/guardrails/test_theme_palette.py` (themes.js hexes must mirror `tokens.css`).
- **Metric cards → `Card`** — the 4 Dashboard + 3 SupervisorDashboard metric tiles and the RateEmployee summary box used `rounded-ctl` (6px) instead of the `Card`/`Surface` radius `rounded-float` (14px); now render through `Card`.
- **Inputs/selects → `inputClass` / `selectClass`** — search + select literals in AuditTrail, Employees, UserManagement, Rollups, RateEmployee now use the shared classes (`rounded-field` 10px, `h-10`); added `selectClass` (no `w-full`) for toolbar filters.

**Icon system (2026-10-04):** migrated all icons from **Lucide** to **Phosphor** (MIT, SF-Symbols-inspired: weights + fill). Added `src/components/icons.js` as the single source — Phosphor components re-exported under the existing Lucide-style names so the 55 call sites did not change. Migrated 23 files (import-source swap only), removed the `lucide-react` dependency, updated `vite.config.js` `manualChunks` (dropped the forced vendor chunk so icons tree-shake/code-split), and added an eslint `no-restricted-imports` guardrail (only `icons.js` may import an icon library). No Apple assets (SF Symbols/SF Pro are proprietary; Phosphor is MIT).

All phases (A–G) complete.
