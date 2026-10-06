# Performa — Frontend Roadmap

**Purpose.** The single place for frontend quality work: the permanent UI standard
(the Anti-Slop Contract) plus a prioritized roadmap to "perfect". Every UI change
is measured against the contract below — not against taste.

> Grounding: `AGENTS.md` §1.9 (design system), `tokens.css` (the token source),
> `docs/SLOP_AUDIT.md` (what "slop" means here), `docs/UIUX_STANDARDS.md`.

---

## The Anti-Slop Contract (permanent UI standard)

A change is not acceptable unless it passes all seven. These are rules, not vibes.

1. **accent = identity, colour = status — never both.** The accent marks brand and
   interactive identity; the four status colours (`good` / `warn` / `notice` /
   `bad`) mark state. A value is encoded **once**: no bar + pill + dot for the same
   thing.
2. **Hairline surfaces, no card shadows, one radius scale.** Cards are `Surface`
   (hairline). Radii come from the tokens (`--r-ctl/field/nav/float`); never a
   bespoke radius.
3. **Fixed type scale — exactly 12 / 14 / 16 / 22 / 30.** Numbers use the platform
   numeric face with tabular figures (`.num` / `font-num`). No arbitrary sizes.
4. **Motion is functional; reduced-motion is honored.** No decorative animation;
   every transition collapses under `prefers-reduced-motion` and the app setting.
5. **Domain-specific over generic.** Prefer the Article 296 domain (docket,
   milestones, scorecard, audit) over dashboard-template filler. No decorative
   icons or uppercase kickers.
6. **Every state uses a shared primitive.** Loading / empty / error render through
   `Skeleton` / `EmptyState` / the error pattern — never ad-hoc markup.
7. **No new dependency without asking.** Reach for the standard library or an
   existing primitive first.
8. **Simple by default** — few, clear elements over feature density. The primary
   action is obvious; no hidden interaction models. If a user would need a hint
   to use it, simplify it.

Enforcement: `npm run lint` (incl. `eslint-plugin-jsx-a11y`),
`backend/tests/guardrails/`, and code review against this list.

---

## Roadmap

Status: `[x]` done · `[ ]` open · `[~]` partial.

### Phase 1 — Correctness (fix regressions) — **done**
- [x] **Score semantics + a11y.** The competency ledger fill now takes its status
  tone (`scoreTone`), and the track exposes `role="meter"` with
  `aria-valuenow/min/max`. (`components/ui/ScoreLedger.jsx`)
- [x] **Extract `ScoreLedger` + `TimelineDocket`** into `components/ui/` and use
  them in **both** `EmployeeDetail` and `EmployeeDashboard`; deleted the
  duplicated competency `<ul>` and the old bar + milestone list.
- [x] **Remove dead imports** — `ScoreMeter` in `Dashboard.jsx` /
  `RateEmployee.jsx` / `EmployeeDashboard.jsx`; unused milestone imports in
  `SupervisorDashboard.jsx`.
- [x] **Brand mark optical tuning** — thicker stroke (2.2) and larger display
  (20px in the 26–32px tiles; 16px in the mobile bar).

### Phase 2 — Consistency — **done**
- [x] **Single source for milestone tones** — `utils/status.js`
  (`milestoneTone`, `milestoneFor`, `scoreTone`, `TONE_TEXT/BG/VARIANT`) consumed
  by `EmployeeList`, `MilestonePill`, `TimelineDocket`, `ScoreLedger`,
  `EmployeeDetail` (status text), and `Dashboard` (milestone buckets).
- [x] **Single source for competency descriptions** —
  `COMPETENCY_DESCRIPTIONS` in `config/domain.js` (was duplicated, with drifted
  text, in `EmployeeDetail` + `EmployeeDashboard`).
- [x] **One-encoder check** on the touched status displays.

### Phase 3 — Accessibility — **open**
- [x] Table `<caption>` + `scope` — verified complete (4 tables, 21 `<th>` scoped);
  `UIUX_AUDIT #37` / `POUR_AUDIT P-3` corrected (were stale).
- [ ] Keyboard/focus audit — `Modal` trap, `GlideSelect`, `RubberSegment`,
  `CommandPalette`; focus return + live regions.
- [ ] Contrast audit on the new elements (mark on accent tile, ledger status
  numerals, docket "Today" row).

### Phase 4 — Signature — **partial**
- [x] Promote the Docket + Ledger as the canonical 180-day / scorecard
  visualization across roles.
- [ ] *(Optional)* a thin proportional hairline under the Docket to restore the
  at-a-glance position cue without reverting to the old bar.
- [ ] Keep the mark's identity consistent in favicon + any app/social icons.

### Phase 5 — Performance — **partial**
- [x] Drop `motion` (138 KB chunk) by porting the vanilla `RubberSegment` to
  `utils/animate.js`. The `motion` dependency is gone; the chunk is removed
  (Settings absorbs ~6 KB).
- [ ] Re-check scroll cost on the mobile sticky bars (`backdrop-blur`).

### Phase 6 — Guardrails & docs — **partial**
- [x] `eslint-plugin-jsx-a11y` wired into `npm run lint`.
- [x] Guardrail tests for the statically-checkable rules —
  `backend/tests/guardrails/test_ui_contract.py`: single radius source (no
  bespoke `border-radius`, no arbitrary `rounded-[…]`) and no animation
  dependency. One-encoder-per-value and status-colour usage stay review-only
  (not statically decidable).
- [x] Delete the dead `StatRow` primitive; tokenize the `GlideSelect` /
  `RubberSegment` colour fallbacks so a no-prop usage is themed.
- [x] This roadmap + the contract as the reference for UI changes.

---

## Definition of done (every item)
`npm run lint` clean · `npm run build` 0 errors ·
`python -m pytest backend/tests/guardrails/` green · visual check in both themes
at 375 / 768 / 1440 · passes the Anti-Slop Contract · no new generic patterns.
