# Performa — Layout Grammar

**Purpose.** One shared way to compose a page, so no page invents its own
section header, stat block, or page top. This is the **composition layer** on
top of the design system (`AGENTS.md` §1.9, `src/tokens.css`): it defines
*structure*, not colour or type — those stay in the tokens.

A page is built from **archetypes** (fixed section order) and **primitives**
(shared components). If a page needs a new shape, add it here first.

## Page archetypes

| Archetype | Shape | Pages |
|---|---|---|
| **Record** | Hero → Lead → Evidence → Full record | `EmployeeDetail` (three role lenses) |
| **Worklist** | PageHeader → StatBand → Action-required → Table → secondary | `employer/Dashboard`, `supervisor/SupervisorDashboard`, `Rollups`, directory |
| **Standing** | PageHeader → Lead (standing) → Evidence → Record | `employee/EmployeeDashboard` |

## Primitives (`frontend/src/components/ui`)

- **`PageHeader`** — the page top (kicker · title · subtitle · actions). Every
  page starts here; the Record archetype uses a hero variant for the title
  block.
- **`SectionHead`** — section title + optional muted subtitle + optional
  right-hand note. The single section heading in the app.
- **`SectionCard`** — `Card` + `SectionHead` (the standard section).
- **`GroupCard`** — a bordered card whose sub-sections are hairline-divided
  (the "Full record" tier: one document instead of a stack of equal cards).
- **`StatBand`** — one hairline-divided row of figures; each cell = tone dot +
  label + figure + caption. `tone` is a statutory tone (`milestoneTone` /
  `scoreTone`) — colour = status, never decoration. `size="base"` steps a
  supporting cell down from the 30px lead.

## Minimal system (pilots)

The converted pages use the reference's flat system — same grid, no surfaces:

- **`Hero`** — the page top: context (left, holds the page's `h1`), one figure +
  a plain-language label (center), the next step (right). The figure is the
  only place `text-hero` is used (fluid 56–120px).
- **`Section`** — a flat section: one 1px `--ink` rule, a numbered gutter
  (`01` + one-line description), a title with an optional mono note. No card.
- **`ListRow` / `ListHead`** — an 80px worklist row on the ten content tracks;
  place its parts with `<Col span={n}>`. Hairline between rows, hover =
  `--hover`.
- **`MilestoneRail`** — the statutory day rail: the full 0–180-day term before
  Day 150, the 150–180 decision window after it (zones = milestone tones).

Converted: directory (`EmployeeList`). Pilots in progress: record, rate form.

## Rules

1. Every section renders through `SectionCard` (or `GroupCard` for a group); no
   page defines its own `CardHead` / `SectionHead`.
2. Every stat row renders through `StatBand`; no hand-rolled stat grids.
3. One lead figure per page/lens at 30px; supporting cells step down
   (`size="base"`).
4. Secondary evidence is `ink-3` and capped ("Show more").
5. One primary action, in the page header.
6. Hairline / flat only; type scale 12 / 14 / 16 / 22 / 30 + `text-hero` (the
   hero figure only); no new widget types (no donuts, no bento, no KPI-card
   grids).
7. Converted pages (minimal system) use `Hero` + `Section` — no cards.
   Unconverted pages keep the card grammar until migrated, one page per
   commit.

Enforced by `backend/tests/guardrails/test_layout_grammar.py`.
