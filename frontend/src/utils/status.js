// Status tones — the single source of truth for "colour = status" (AGENTS.md
// §1.9). Every milestone/score/trend tone is decided here once and rendered
// consistently, so no component re-derives a threshold or hard-codes a colour.
import {
  MILESTONE_REVIEW,
  MILESTONE_NOTICE,
  MILESTONE_CRITICAL,
  MILESTONES,
  PROBATION_DAYS,
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

export const TONE_VARIANT = {
  ok: 'ok',
  warn: 'warn',
  notice: 'notice',
  bad: 'bad',
};

// Statutory milestone tone for a day count (Article 296 thresholds).
export function milestoneTone(day) {
  if (day >= MILESTONE_CRITICAL) return 'bad';
  if (day >= MILESTONE_NOTICE) return 'notice';
  if (day >= MILESTONE_REVIEW) return 'warn';
  return 'ok';
}

// Record-level milestone { tone, label } for the directory list.
export function milestoneFor(daysElapsed, status) {
  if (status !== 'active') return { tone: 'ok', label: 'Regular' };
  const tone = milestoneTone(daysElapsed);
  const label =
    tone === 'bad' ? 'Critical' : tone === 'notice' ? 'Notice' : tone === 'warn' ? 'Review' : 'On track';
  return { tone, label };
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
  if (s >= 3.0) return 'warn';
  return 'bad';
}
