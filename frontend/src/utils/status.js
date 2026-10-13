// Status tones + probation stage — the single source of truth for "colour =
// status" (AGENTS.md §1.9) and for day/stage formatting (one shared module, per
// AGENTS.md §1.2). Every milestone/score/trend tone and every stage label is
// decided here once and rendered consistently, so no component re-derives a
// threshold, re-implements day math, or hard-codes a colour.
import {
  MILESTONE_REVIEW,
  MILESTONE_NOTICE,
  MILESTONE_CRITICAL,
  MILESTONES,
  PROBATION_DAYS,
  CRITICAL_GAP_FLOOR,
} from '../config/domain';

// Four semantic tones, mapped to the four status colours. `text`/`bg` are the
// Tailwind utilities; `variant` matches <Badge variant>.
export const TONE_TEXT = {
  ok: 'text-good',
  warn: 'text-warn',
  notice: 'text-notice',
  bad: 'text-bad',
};

export const TONE_BG = {
  ok: 'bg-good',
  warn: 'bg-warn',
  notice: 'bg-notice',
  bad: 'bg-bad',
};

// Muted 60% wash for score bars (the numeral carries the full-strength tone).
export const TONE_FILL = {
  ok: 'bg-good/60',
  warn: 'bg-warn/60',
  notice: 'bg-notice/60',
  bad: 'bg-bad/60',
};

export const TONE_VARIANT = {
  ok: 'ok',
  warn: 'warn',
  notice: 'notice',
  bad: 'bad',
};

// Canonical stage labels, grounded in the capstone manuscript: Article 296 sets a
// six-month (180-day) cap and requires the standards to be communicated on Day 1;
// the app's own review milestones fall at Day 150 / 165 / 178; past Day 180 the
// employee is regularized by constructive regularization. These are the ONLY
// stage strings — never re-word them at a call site.
export const STAGE_LABEL = {
  ok: 'In evaluation',
  warn: `Day ${MILESTONE_REVIEW} · Performance appraisal`,
  notice: `Day ${MILESTONE_NOTICE} · Milestone review`,
  bad: `Day ${MILESTONE_CRITICAL} · Final milestone`,
  past: `Past Day ${PROBATION_DAYS} · constructive regularization`,
};

// Short stage names for dense cells (the roster's Status column). Same source,
// sentence case; still manuscript-grounded (no "notice window"/"critical action").
export const STAGE_SHORT = {
  ok: 'In evaluation',
  warn: `Day ${MILESTONE_REVIEW} appraisal`,
  notice: `Day ${MILESTONE_NOTICE} milestone`,
  bad: `Day ${MILESTONE_CRITICAL} milestone`,
  past: `Past Day ${PROBATION_DAYS}`,
};

// Statutory milestone tone for a day count (Article 296 thresholds).
export function milestoneTone(day) {
  if (day >= MILESTONE_CRITICAL) return 'bad';
  if (day >= MILESTONE_NOTICE) return 'notice';
  if (day >= MILESTONE_REVIEW) return 'warn';
  return 'ok';
}

// The record-level stage for a day count + status: { tone, key, label }. `key` is
// one of ok/warn/notice/bad/past/regularized/terminated. Terminal status wins;
// past-cap is its own key (the tone is bad but the label is not "Final milestone").
export function milestoneStage(daysElapsed, status = 'active') {
  const s = (status || 'active').toLowerCase();
  if (s === 'regularized') return { tone: 'ok', key: 'regularized', label: 'Regularized' };
  if (s === 'terminated') return { tone: 'ok', key: 'terminated', label: 'Terminated' };
  if (daysElapsed > PROBATION_DAYS) return { tone: 'bad', key: 'past', label: STAGE_LABEL.past };
  const tone = milestoneTone(daysElapsed);
  return { tone, key: tone, label: STAGE_LABEL[tone] };
}

// Record-level { tone, label } for the directory list (tone-only consumers).
export function milestoneFor(daysElapsed, status) {
  const { tone, label } = milestoneStage(daysElapsed, status);
  return { tone, label };
}

// The short stage name for a day count + status (dense cells).
export function stageShort(daysElapsed, status = 'active') {
  const { key } = milestoneStage(daysElapsed, status);
  if (key === 'regularized') return 'Regularized';
  if (key === 'terminated') return 'Terminated';
  return STAGE_SHORT[key] || STAGE_SHORT.ok;
}

// One shared probation-day formatter (AGENTS.md §1.2): "Day 150 of 180" up to the
// cap, "Day 181 · past cap" once past it. Never render "181 / 180".
export function formatProbationDay(daysElapsed) {
  const d = Number(daysElapsed) || 0;
  return d > PROBATION_DAYS ? `Day ${d} · past cap` : `Day ${d} of ${PROBATION_DAYS}`;
}

// The next statutory milestone day for a day count (the current day counts as
// "due today"), or null once past the Day 180 cap.
export function nextMilestone(daysElapsed) {
  for (const day of [...MILESTONES, PROBATION_DAYS]) {
    if (daysElapsed <= day) return day;
  }
  return null;
}

// Competency score tone against the regularizing target: >= target passes,
// >= 3.0 is a soft warn, below is a hard fail (Article 296 regularizing target).
export function scoreTone(score, target) {
  const s = Number(score) || 0;
  if (s >= Number(target)) return 'ok';
  if (s >= CRITICAL_GAP_FLOOR) return 'warn';
  return 'bad';
}
