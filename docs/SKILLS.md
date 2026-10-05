# Performa — Skill Playbook (adopted subset)

**Purpose.** Performa does not use the full GSD workflow (no `.planning/`; planning lives in `ROADMAP.md` + `AGENTS.md`). This file records the **Tier 1/2 GSD skills the team uses**, when to reach for each, and the rules they operate under.

> These skills are **already installed and enabled** — opencode auto-loads external skills from `~/.claude/skills/`, and the GSD install profile is `full`. Nothing needs turning on; this is the curated shortlist so we actually use them.

**They do not override the project.** Every skill runs *inside* the invariants: `AGENTS.md` §1 and the values in `ARCHITECTURE.md` win over any skill's default behavior. A skill that proposes something touching timezone, the 180-day/4.0 rules, competencies, RBAC, tenancy, the dual audits, or Gemini scope is a STOP-AND-ASK.

---

## Tier 1 — highest value

| Skill | What it does | Reach for it when |
|---|---|---|
| **`gsd-docs-update`** | Generates/updates docs **verified against the codebase**. | After any change that could drift a doc — the biggest live risk across `ARCHITECTURE.md`, `MANUSCRIPT_SYNC.md`, `UIUX_STANDARDS.md`, `POUR_AUDIT.md`, `PERFORMANCE.md`. |
| **`gsd-code-review`** | Reviews changed source for bugs, security, and quality. | Before committing a non-trivial change or before a defense demo. Complements (never replaces) the guardrail tests + `ruff`/`eslint`. |
| **`gsd-verify-work`** | Conversational UAT of built features. | Capstone-defense rehearsal; validating an end-to-end flow (rate → rollup → sign-off → dispatch → ack). |
| **`gsd-ui-review`** | Retroactive 6-pillar visual audit of frontend code. | After UI work; pairs with `docs/DESIGN_QA.md`, `SLOP_AUDIT.md`, `POUR_AUDIT.md`. |

## Tier 2 — valuable

| Skill | What it does | Reach for it when |
|---|---|---|
| **`gsd-debug`** | Systematic debugging with persistent state across context resets. | A bug that spans turns — pairs with `docs/BACKEND_DEBUG.md`. |
| **`gsd-map-codebase`** | Parallel mappers → a codebase map (`.planning/codebase/`). | Onboarding or building panel/reviewer context. *Note: writes under `.planning/`, which we otherwise don't use.* |
| **`gsd-secure-phase`** | Retroactive threat-mitigation verification. | An explicit security pass over RBAC / tenancy scoping / audit immutability (`ARCHITECTURE.md` §3, §5). |

## Project skills (third-party, committed)

| Skill | What it does | Where |
|---|---|---|
| **`ponytail`** | "Lazy senior dev" YAGNI ladder — smallest working change, stdlib/native/reuse before new code or deps. Levels: `lite`/`full` (default)/`ultra`; off with "stop ponytail". | `.opencode/skills/ponytail/SKILL.md` (MIT, `DietrichGebert/ponytail`) |

`ponytail` reinforces what `AGENTS.md` §3 already requires (smallest change, no new deps without asking). Its SKILL.md carries a **Performa precedence** section: the `AGENTS.md`/`ARCHITECTURE.md` invariants win, and its "ship the lazy version and question it" yields to STOP-AND-ASK for anything touching timezone, the 180-day/4.0 rules, RBAC/tenancy, the audits, or XAI terms. Phase-4 verification still applies.

## Deliberately not adopted
- **Full GSD phase framework** (`new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, milestones) — would duplicate `ROADMAP.md` + `AGENTS.md` (two competing planners, which `AGENTS.md` warns against).
- **Git-flow skills** (`ship`, `pr-branch`, `undo`, `cleanup`) — the repo has its own commit/push convention and a `git push* → ask` permission gate.
- **`gsd-new-project`** — the project already exists.

## How to invoke
- **opencode:** load the skill by name (e.g. the `gsd-code-review` skill).
- **Claude Code:** run it as its slash command.

## Verification contract (unchanged)
Whatever a skill produces, the project's Phase 4 checks still apply: `cd frontend && npm run build` (0 errors), `npm run lint`, `python -m pytest backend/tests/ -q` (0 failures), `python -m ruff check backend`. Never claim a pass you did not run.
