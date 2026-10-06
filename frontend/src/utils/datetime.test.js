import { describe, it, expect } from 'vitest';
import {
  manilaTodayISO,
  parseDateOnly,
  daysElapsed,
  addDays,
  milestoneDate,
  formatDate,
} from './datetime';

describe('datetime (Asia/Manila)', () => {
  it('manilaTodayISO returns a YYYY-MM-DD calendar date', () => {
    expect(manilaTodayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parseDateOnly parses a date string and rejects empties', () => {
    const d = parseDateOnly('2026-05-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // zero-based May
    expect(d.getDate()).toBe(5);
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
  });

  it('addDays adds whole calendar days without UTC drift', () => {
    expect(formatDate(addDays('2026-05-05', 10))).toBe('May 15, 2026');
    expect(formatDate(addDays('2026-12-31', 1))).toBe('Jan 1, 2027');
  });

  it('milestoneDate is start + N days (Day-0 convention)', () => {
    expect(formatDate(milestoneDate('2026-01-01', 150))).toBe('May 31, 2026');
    expect(formatDate(milestoneDate('2026-01-01', 180))).toBe('Jun 30, 2026');
  });

  it('daysElapsed is 0 on the start date and counts forward', () => {
    const today = manilaTodayISO();
    expect(daysElapsed(today)).toBe(0);
    expect(daysElapsed('')).toBe(0);

    const d = parseDateOnly(today);
    d.setDate(d.getDate() - 10);
    const startISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    expect(daysElapsed(startISO)).toBe(10);
  });

  it('formatDate is defensive on missing input', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate('2026-10-06')).toBe('Oct 6, 2026');
  });
});
