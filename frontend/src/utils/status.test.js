import { describe, it, expect } from 'vitest';
import { milestoneTone, milestoneFor, nextMilestone, scoreTone, TONE_TEXT } from './status';

describe('status tones', () => {
  it('maps day counts to statutory milestone tones', () => {
    expect(milestoneTone(149)).toBe('ok');
    expect(milestoneTone(150)).toBe('warn');
    expect(milestoneTone(165)).toBe('notice');
    expect(milestoneTone(178)).toBe('bad');
  });

  it('labels a non-active employee as Regular', () => {
    expect(milestoneFor(100, 'regularized')).toEqual({ tone: 'ok', label: 'Regular' });
  });

  it('labels active employees by milestone', () => {
    expect(milestoneFor(150, 'active')).toEqual({ tone: 'warn', label: 'Review' });
    expect(milestoneFor(30, 'active')).toEqual({ tone: 'ok', label: 'On track' });
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
