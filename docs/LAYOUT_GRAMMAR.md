# Performa — Layout Grammar

**Purpose.** One shared way to compose a page, so no page invents its own
section header, stat block, or page top. This is the **composition layer** on
top of the design system (`AGENTS.md` §1.9, `src/tokens.css`): it defines
*structure*, not colour or type — those stay in the tokens.

A page is built from **archetypes** (fixed section order) and **primitives**
(shared components). If a page needs a new shape, add it here first.

## Page top

The page title and its one primary action render in the **shell toolbar** (the
iMac concept's window chrome), not in the page body. A page passes `title` and
`actions` to `<Page>`; `AppShell`'s toolbar reads them through `ChromeContext`.
The toolbar note is `<org> · <date>`.

## Page archetypes

| Archetype | Shape | Pages |
|---|---|---|
| **Overview** | KPI strip → score/alerts → deadlines/interventions | `employer/Dashboard` |
| **Record** | Hero → Standing \| Timeline → Recommendation → Evidence | `EmployeeDetail` (three role lenses) |
| **Worklist** | StatBand → Table → secondary | `supervisor/SupervisorDashboard`, `Rollups`, directory |
| **Standing** | Lead (standing) → Evidence → Record | `employee/EmployeeDashboard` |

## Primitives (`frontend/src/components/ui`)

- **`Page`** — the page wrapper: owns the per-page vertical rhythm and routes
  the title/actions into the toolbar. Every routed page renders through it.
- **`PageGrid` / `Row` / `Col`** — the 12-column page grid. A page must not
  declare its own page-level grid.
- **`SectionHead`** — section title + optional muted subtitle + optional
  right-hand note. The single section heading in the app.
- **`Card` / `Surface`** — the hairline surface. `Card flat` drops the chrome so
  a block sits directly on the page surface.
- **`GroupCard`** — a flat group whose sub-sections are hairline-divided (the
  "Full record" tier: one document instead of a stack of equal cards).
- **`StatBand`** — one hairline-divided row of figures (the KPI strip); each
  cell = tone dot + label + figure + caption. `tone` is a statutory tone
  (`milestoneTone` / `scoreTone`) — the dot carries status; the figure stays
  ink. `size="base"` steps a supporting cell down from the 22px lead.
- **`PageBrief`** — the plain-language lead for a page/lens: one sentence, the
  one figure it rests on, and the one next step.

## Rules

1. Every section renders through `SectionHead` (+ `Card`/`GroupCard` as needed);
   no page defines its own `CardHead` / `SectionHead`.
2. Every stat row renders through `StatBand`; no hand-rolled stat grids.
3. One lead figure per page/lens at 30px; supporting cells step down
   (`size="base"`).
4. Secondary evidence is `ink-3` and capped ("Show more").
5. One primary action, in the toolbar.
6. Hairline / flat only; type scale 12 / 14 / 16 / 22 / 30; no new widget types
   (no donuts, no bento, no KPI-card grids).

Enforced by `backend/tests/guardrails/test_layout_grammar.py`.
