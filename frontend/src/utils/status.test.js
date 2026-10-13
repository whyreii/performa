import { describe, it, expect } from 'vitest';
import {
  milestoneTone,
  milestoneStage,
  milestoneFor,
  stageShort,
  formatProbationDay,
  nextMilestone,
  scoreTone,
  TONE_TEXT,
} from './status';

describe('status tones', () => {
  it('maps day counts to statutory milestone tones', () => {
    expect(milestoneTone(149)).toBe('ok');
    expect(milestoneTone(150)).toBe('warn');
    expect(milestoneTone(165)).toBe('notice');
    expect(milestoneTone(178)).toBe('bad');
  });

  it('maps day counts to the canonical stage (manuscript-grounded labels)', () => {
    expect(milestoneStage(149, 'active')).toEqual({
      tone: 'ok',
      key: 'ok',
      label: 'In evaluation',
    });
    expect(milestoneStage(150, 'active')).toEqual({
      tone: 'warn',
      key: 'warn',
      label: 'Day 150 · Performance appraisal',
    });
    expect(milestoneStage(165, 'active')).toEqual({
      tone: 'notice',
      key: 'notice',
      label: 'Day 165 · Milestone review',
    });
    expect(milestoneStage(178, 'active')).toEqual({
      tone: 'bad',
      key: 'bad',
      label: 'Day 178 · Final milestone',
    });
  });

  it('gives past-cap its own stage (not "Final milestone")', () => {
    expect(milestoneStage(181, 'active')).toEqual({
      tone: 'bad',
      key: 'past',
      label: 'Past Day 180 · constructive regularization',
    });
  });

  it('reflects a terminal decision over the day clock', () => {
    expect(milestoneStage(100, 'regularized')).toEqual({
      tone: 'ok',
      key: 'regularized',
      label: 'Regularized',
    });
    expect(milestoneStage(100, 'terminated')).toEqual({
      tone: 'ok',
      key: 'terminated',
      label: 'Terminated',
    });
  });

  it('formats a probation day without ever rendering "181 / 180"', () => {
    expect(formatProbationDay(149)).toBe('Day 149 of 180');
    expect(formatProbationDay(150)).toBe('Day 150 of 180');
    expect(formatProbationDay(180)).toBe('Day 180 of 180');
    expect(formatProbationDay(181)).toBe('Day 181 · past cap');
  });

  it('milestoneFor delegates to the shared stage', () => {
    expect(milestoneFor(100, 'regularized')).toEqual({ tone: 'ok', label: 'Regularized' });
    expect(milestoneFor(150, 'active')).toEqual({
      tone: 'warn',
      label: 'Day 150 · Performance appraisal',
    });
    expect(milestoneFor(30, 'active')).toEqual({ tone: 'ok', label: 'In evaluation' });
  });

  it('exposes a short stage for dense cells', () => {
    expect(stageShort(30, 'active')).toBe('In evaluation');
    expect(stageShort(150, 'active')).toBe('Day 150 appraisal');
    expect(stageShort(181, 'active')).toBe('Past Day 180');
    expect(stageShort(100, 'regularized')).toBe('Regularized');
  });

  it('finds the next statutory milestone day for a day count', () => {
    expect(nextMilestone(149)).toBe(150);
    expect(nextMilestone(150)).toBe(150);
    expect(nextMilestone(164)).toBe(165);
    expect(nextMilestone(165)).toBe(165);
    expect(nextMilestone(177)).toBe(178);
    expect(nextMilestone(178)).toBe(178);
    expect(nextMilestone(180)).toBe(180);
    expect(nextMilestone(181)).toBeNull();
  });

  it('scores against the regularizing target', () => {
    expect(scoreTone(4.2, 4.0)).toBe('ok');
    expect(scoreTone(3.5, 4.0)).toBe('warn');
    expect(scoreTone(2.0, 4.0)).toBe('bad');
  });

  it('exposes the tone text utilities', () => {
    expect(TONE_TEXT.ok).toBe('text-good');
    expect(TONE_TEXT.bad).toBe('text-bad');
  });
});
