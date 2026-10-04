# Performa UI/UX Standards & Philosophies

**Purpose.** This document maps seven widely-cited UI/UX standards and philosophies
to their concrete implementation in Performa, and records the factual corrections
needed for an accurate thesis defense. Every claim below is grounded in the source
tree; file paths are given so each assertion can be verified.

> **Verification protocol.** `cd frontend && npm run build` (0 errors) and
> `python -m pytest backend/tests/ -q` (all pass) were run after the changes in this
> document. Contrast ratios were computed with the WCAG 2.1 relative-luminance
> formula (see [Appendix A](#appendix-a--contrast-audit-methodology)).

---

## Summary table

| # | Standard / philosophy | Status in Performa | Primary evidence |
|---|-----------------------|--------------------|------------------|
| 1 | Human-in-the-loop (HITL) AI | **Implemented** | `backend/ml/`, `EmployeeDetail.jsx`, `Rollups.jsx` |
| 2 | Evidentiary / forensic UI | **Implemented** | `AuditTrail.jsx`, `ActivityLog.jsx`, `routers/evaluations.py` |
| 3 | Chronological urgency | **Implemented** | `MilestonePill.jsx`, `tokens.css`, `config/domain.js` |
| 4 | NN/g usability heuristics | **Implemented** | `Rollups.jsx`, `EmployeeDetail.jsx`, `ToastContext.jsx` |
| 5 | Calm technology / Rams | **Implemented** | `tokens.css`, `employer/Dashboard.jsx` |
| 6 | Swiss style / IBM Plex typography | **Implemented** | `index.css`, `tokens.css`, `tailwind.config.js` |
| 7 | WCAG 2.1 Level AA + ergonomics | **Implemented & audited** | `tokens.css`, `index.css`, Appendix A |

Corrections to the commonly circulated list are collected in
[Appendix B](#appendix-b--corrections-to-the-source-list).

---

## 1. Human-in-the-loop (HITL) AI

**Principle.** The AI advises; a human decides. The system must expose *why* it
recommended something and must never take an irreversible employment action on its own.

**Implementation.**
- **Explainable AI (XAI).** The regularization path runs a **Random Forest**
  classifier whose **Feature Importance** values are returned to the UI
  (`GET /api/evaluations/{id}/risk-explanation`), rendered under "ML Risk Explanation"
  in `EmployeeDetail.jsx`. A **Gemini Performance Rationale** accompanies the
  recommendation (`routers/evaluations.py`, `Regularization Recommendation` panel).
- **Local + global explainability.** Beyond Gini and permutation feature importance,
  `backend/ml/explain.py` computes **exact Shapley values** over the five
  competencies for each prediction, and the panel renders a per-competency
  attribution waterfall. See `docs/XAI_METHODOLOGY.md`.
- **Advisory only.** Regularization status is changed solely through an explicit
  employer action (`POST /api/employees/{id}/status`, restricted to the `employer`
  role — see `AGENTS.md` §3.2). The AI produces a *recommendation*, never a status.
- **Non-destructive regeneration.** Regenerating a monthly rollup or regularization
  recommendation **never deletes a signed record**; once a summary is dispatched or
  acknowledged the API returns **409 Conflict** (`routers/evaluations.py`).

**Why it matters for the manuscript.** This is the core "decision-support, not
decision-making" claim and satisfies the explainability requirement for defense.

---

## 2. Evidentiary / forensic UI

**Principle.** A compliance platform is a legal instrument. It must produce
immutable, attributable, printable records — and it must keep its audit surfaces
separate from ordinary application logs.

**Implementation.**
- **Dual audit separation** (an `AGENTS.md` invariant):
  - `/audits` → **Evidentiary Labor Score Audit Trail** (append-only, DOLE/NLRC
    defense), `pages/admin/AuditTrail.jsx`, `routers/evaluations.py`
    (`GET /api/evaluations/audit-trail`).
  - `/admin/activity` → **IT Sysadmin Security Activity Log**,
    `pages/admin/ActivityLog.jsx`, `routers/admin.py`.
- **Append-only history.** Weekly evaluations are recorded as before→after score
  deltas with evaluator attribution; there is no destructive edit path.
- **Digital acknowledgment.** Employees acknowledge monthly summaries
  (`routers/evaluations.py` ack endpoint), and acknowledge initial performance
  standards (`EmployeeDetail.jsx` → "Sign Acknowledgment").
- **Print-first output.** A global print stylesheet hides the app chrome and forces
  an ink-on-paper palette (`index.css`, `@media print`). The **audit trail** has a
  DOLE header and signature lines, and the **employee scorecard** now prints a
  pristine evaluation sheet (see §7 and the print block in `EmployeeDetail.jsx`).

---

## 3. Chronological urgency

**Principle.** In a time-bound statutory process, "how much time is left" must be
unmistakable at a glance, with escalating visual weight as deadlines approach.

**Implementation.**
- **Live Manila clock.** The sidebar shows the current `Asia/Manila (UTC+8)` time so
  users reason in the same timezone the law is applied in.
- **Four-stage escalation curve.** `MilestonePill.jsx` renders a distinct tone per
  statutory window (Article 296):

  | Days elapsed | Tone | Token | Meaning |
  |---|---|---|---|
  | `< 150` | neutral | `--ink-2` / `--line` | Nominal probation |
  | `150 – 164` | warn (amber) | `--warn` | **Day 150** Performance Review due |
  | `165 – 177` | notice (orange) | `--notice` | **Day 165** 15-Day Written Notice buffer |
  | `≥ 178` | bad (crimson, pulsing) | `--bad` | **Day 178** critical 48h to auto-regularization |
  | regularized | ok (green) | `--good` | Regular status conferred |
  | terminated | neutral | `--ink-2` / `--line` | Non-regularized |

  The same four-stage logic colors every employee progress bar
  (`EmployeeDetail.jsx`, `Employees.jsx`, `employer/Dashboard.jsx`,
  `supervisor/SupervisorDashboard.jsx`, `employee/EmployeeDashboard.jsx`).
- **Deadlines as dates.** `EmployeeDetail.jsx` lists Day 0 (Start), Day 150
  (Review Due), Day 165 (Notice Due) and Day 180 (Deadline) with Manila-computed
  dates (`utils/datetime.js`).

---

## 4. NN/g usability heuristics

**Principle.** Nielsen's heuristics: prevent errors, show system status, and
recognize rather than recall.

**Implementation.**
- **Error prevention.** The "Generate" regularization button is **disabled** until
  at least one weekly rating exists, with an explanatory tooltip
  (`title="Submit weekly ratings first"`) and an empty state that links directly to
  "Rate Employee →" (`EmployeeDetail.jsx`).
- **Visibility of system status.** Success/error feedback via toasts
  (`context/ToastContext.jsx`); the rollup modal shows **elapsed days** and
  **department** so the user does not have to recall the cycle
  (`employer/Rollups.jsx`).
- **Recognition over recall.** Triage chips, tab-scoped filters, and a rollup default
  month aligned to the employee's own cycle remove mental bookkeeping
  (`Employees.jsx`, `Rollups.jsx`).
- **Help & documentation.** The `?` shortcut opens a keyboard-shortcut reference
  (`components/layout/ShortcutModal.jsx`).

---

## 5. Calm technology / Dieter Rams

**Principle.** Good design is unobtrusive: it informs without demanding attention,
and it uses a restrained, semantic system.

**Implementation.**
- **Semantic design tokens.** All color, type, spacing, radius and motion live in
  `tokens.css`; components consume roles (`--surface`, `--line`, `--ink`, `--accent`),
  never raw hex. The five themes are **`paper`, `midnight`, `dusk`, `mist`, `sage`**
  (switched via `<html data-theme="…">`).
- **Restraint.** The employer dashboard was condensed to a **single callout banner**
  instead of three duplicated alerts (`employer/Dashboard.jsx`).
- **Motion that respects the user.** Transitions are 160 ms and disabled under
  `prefers-reduced-motion` (`index.css`).

---

## 6. Swiss style / IBM Plex typography

**Principle.** Objective, grid-driven layout with a functional type system;
numerals that align and characters that never confuse.

**Implementation.**
- **Typeface.** The UI uses **IBM Plex Sans**, and all numeric/date/score/ID values
  use **IBM Plex Mono** (`index.css` imports latin-only subsets, weights 400–700;
  `tokens.css` `--font` / `--mono`; `tailwind.config.js` `fontFamily`).
- **Tabular numerals.** `.mono` sets `font-variant-numeric: tabular-nums`, so scores
  and dates align in columns (`index.css`).
- **Character disambiguation.** IBM Plex Mono is chosen in part because it clearly
  distinguishes `I` / `l` / `1` and `0` / `O` — important for IDs and hashes.
- **Grid discipline.** Consistent 4/8 px spacing scale (`--s1`…`--s7`) and a shared
  card/float radius (`--r-ctl`, `--r-float`).
- **Corner-radius scale — one per class, not one global value.** Radii are semantic
  roles: controls `--r-ctl` (6 px), fields/nav `--r-field`/`--r-nav` (10 px),
  surfaces `--r-float` (14 px), full-round pills/avatars `rounded-full`. Every
  card/panel renders through `Surface.jsx` (which `Card.jsx` wraps), so the surface
  definition exists once.
- **Concentric nesting.** A rounded surface placed *inside* another must use a
  smaller radius so the corners stay concentric: `inner = outer − gap` (Apple's
  concentric-rectangle rule). The derived token `--r-float-inner` (10 px,
  `rounded-float-inner`) exists for this — apply it to any card nested in a card or
  modal. Equal radii on nested surfaces read as a visual error.

---

## 7. WCAG 2.1 Level AA + ergonomics

**Principle.** Meet AA contrast for text and UI, never rely on color alone, and keep
the interface fully keyboard-operable.

**Implementation.**
- **Color independence.** Status is always color **plus** text/icon: `Badge` renders
  a label (`Active`, `Day 178 · Critical Action`, `Regularized`), `StatusDot` pairs a
  dot with a label, and `ScoreMeter` shows the numeric score.
- **Keyboard operability.** A global `:focus-visible` ring (2 px accent, `!important`
  so it survives `focus:outline-none`), a `?` shortcut modal, `Esc` to close
  dialogs/modals (`hooks/useEscapeKey.js`), and `Ctrl/⌘+K` command palette
  (`AppShell.jsx`).
- **Verified contrast.** All five themes were audited and adjusted so every text
  token and badge meets **≥ 4.5:1** (Appendix A). Minimum measured value:
  **4.50:1**.

### Fixes applied for AA

| Theme | Token | Before | After | Reason |
|---|---|---|---|---|
| midnight | `--accent` | `#3b82f6` | `#60a5fa` | badge text vs tint was 4.12:1 |
| midnight | `--bad` | `#f43f5e` | `#fb7185` | badge text vs tint was 4.12:1 |
| dusk | `--accent` | `#9368f7` | `#a78bfa` | badge text vs tint was 3.88:1 |
| all | badge tint | `bg-*/15` | `bg-*/8` | 15 % self-tint dropped text to ~3.9–4.4:1 |
| all | `--notice` | *(new)* | see tokens | Day 165 needed a distinct orange tone |

---

## Appendix A — Contrast audit methodology

WCAG 2.1 relative luminance:

```
L = 0.2126·R + 0.7152·G + 0.0722·B   (channels linearised per sRGB)
contrast = (L_light + 0.05) / (L_dark + 0.05)
```

Thresholds: **4.5:1** normal text, **3:1** large text (≥ 18 pt / 24 px, or ≥ 14 pt
bold) and UI components. Badges render at 11–12 px, so the **4.5:1** threshold
applies. Badge backgrounds are the semantic color composited at **8 %** over the
theme surface.

### Measured ratios (final tokens)

| Theme | `--ink` on bg / surface | `--ink-2` | `--ink-3` | badge accent / good / bad / warn / notice | on-accent on accent |
|---|---|---|---|---|---|
| paper | 16.12 / 17.85 | 6.97 / 7.72 | 4.68 / 5.18 | 4.60 / 4.81 / 6.95 / 4.58 / 4.62 | 5.13 |
| midnight | 18.03 / 16.10 | 7.78 / 6.94 | 5.19 / 4.64 | 6.13 / 6.16 / 5.88 / 7.19 / 6.86 | 7.74 |
| dusk | 17.87 / 16.01 | 7.82 / 7.01 | 5.18 / 4.64 | 5.76 / 8.01 / 5.87 / 9.03 / 6.87 | 7.22 |
| mist | 16.15 / 17.85 | 6.86 / 7.58 | 4.64 / 5.13 | 4.57 / 4.57 / 4.50 / 4.61 / 4.50 | 5.10 |
| sage | 15.19 / 17.21 | 7.05 / 7.99 | 4.65 / 5.27 | 4.90 / 4.75 / 5.48 / 4.67 / 4.50 | 5.47 |

**Result: 0 failures — minimum 4.50:1 across all five themes.** (Each pair is shown
as *on bg / on surface*.)

---

## Appendix B — Corrections to the source list

The circulated list of "7 standards" contained several inaccuracies about Performa.
Corrected here for the record:

1. **Theme names are wrong.** Performa's themes are **`paper`, `midnight`, `dusk`,
   `mist`, `sage`** — *not* "Navy, Charcoal, Slate, Cream, Neutral".
2. **"Native ₱ symbol rendering" does not apply.** Performa has **no currency**
   anywhere in its UI (verified: zero `₱`/peso/amount usages). It is a performance-
   and-compliance platform, not a payroll system.
3. **"4 color states" was inaccurate.** The escalation curve is **neutral → warn
   (Day 150) → notice (Day 165) → bad (Day 178+)**, plus `ok` (regularized) and
   neutral (terminated). Day 165 is now a genuinely distinct tone (`--notice`); it
   was previously sharing `warn` with Day 150.
4. **"Contrast strictly meets 4.5:1" was an unverified assertion.** It is now a
   *verified* claim (Appendix A) after fixing three accents and lowering the badge
   tint to 8 %.
5. **"Printing an audit trail *or* employee scorecard."** Both are supported: the
   audit trail via its DOLE-header print layout, and the employee scorecard via the
   new print sheet in `EmployeeDetail.jsx` (official header + signature block).

---

## Appendix C — Files touched for this standard

| File | Change |
|---|---|
| `frontend/src/tokens.css` | AA-safe `--accent`/`--bad`; new `--notice` token (all themes) |
| `frontend/tailwind.config.js` | `notice` color; `opacity.8` |
| `frontend/src/components/ui/Badge.jsx` | `notice` variant; tint `15 → 8` |
| `frontend/src/components/ui/MilestonePill.jsx` | Day 165 → `notice` tone |
| `frontend/src/pages/employees/EmployeeDetail.jsx` | print sheet + signature block; Day-165 tone |
| `frontend/src/pages/**/*.jsx` | four-stage escalation in all progress bars |
| `frontend/src/index.css` | scoped `.print-sheet` print rules |
