import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  manilaTodayISO,
  parseDateOnly,
  parseInstant,
  daysElapsed,
  daysUntil,
  monthNumberFor,
  addDays,
  milestoneDate,
  formatDate,
} from './datetime';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('datetime (Asia/Manila)', () => {
  it('manilaTodayISO returns a YYYY-MM-DD calendar date', () => {
    expect(manilaTodayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('honors the VITE_PERFORMA_TODAY dev override in one place', () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-06-15');
    expect(manilaTodayISO()).toBe('2026-06-15');
    // ...and every Manila date helper derives from it.
    expect(daysElapsed('2026-06-05')).toBe(10);
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
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    expect(daysElapsed('2026-10-11')).toBe(0);
    expect(daysElapsed('')).toBe(0);
    expect(daysElapsed('2026-10-01')).toBe(10);
  });

  it('daysUntil counts whole Manila days to a date (negative when past)', () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    expect(daysUntil('2026-10-12')).toBe(1);
    expect(daysUntil('2026-10-11')).toBe(0);
    expect(daysUntil('2026-10-10')).toBe(-1);
    // The Phase 1 example: Sep 4 start → Day-150 review is 113 days away.
    expect(daysUntil(milestoneDate('2026-09-04', 150))).toBe(113);
  });

  it('monthNumberFor mirrors backend domain.month_number_for (days // 30 + 1)', () => {
    const cases = [
      [0, 1], [29, 1],
      [30, 2], [59, 2],
      [60, 3], [89, 3],
      [90, 4], [119, 4],
      [120, 5], [149, 5],
      [150, 6], [179, 6],
      [180, 7],
    ];
    for (const [days, expected] of cases) {
      expect(monthNumberFor(days)).toBe(expected);
    }
  });

  it('parseInstant reads an offset-less API datetime as UTC, not browser-local', () => {
    // Backend stores UTC; SQLite drops tzinfo → naive string must be UTC.
    const instant = Date.UTC(2026, 9, 13, 4, 13, 23);
    expect(parseInstant('2026-10-13T04:13:23').getTime()).toBe(instant);
    // An explicit offset is honored as-is.
    expect(parseInstant('2026-10-13T04:13:23+00:00').getTime()).toBe(instant);
    // Date-only strings remain calendar dates.
    expect(parseInstant('2026-05-05').getDate()).toBe(5);
    expect(parseInstant('')).toBeNull();
  });

  it('formatDate renders API instants in Asia/Manila (the 8h drift regression)', () => {
    // 04:13 UTC is 12:13 in Manila — the exact case that showed 8h early.
    expect(formatDate('2026-10-13T04:13:23', { withTime: true })).toBe(
      'Oct 13, 2026, 12:13:23 PM'
    );
    // Offset-aware (Postgres) yields the same instant.
    expect(formatDate('2026-10-13T04:13:23+00:00', { withTime: true })).toBe(
      'Oct 13, 2026, 12:13:23 PM'
    );
    // Date-only strings and calendar Date objects are not shifted.
    expect(formatDate('2026-05-05')).toBe('May 5, 2026');
    // A UTC instant that rolls into the next Manila day.
    expect(formatDate('2026-10-13T20:00:00', { withTime: true })).toBe(
      'Oct 14, 2026, 04:00:00 AM'
    );
  });
});
