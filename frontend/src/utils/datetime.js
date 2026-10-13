// Asia/Manila date helpers. Dates are treated as calendar dates (no UTC drift).

import { PROBATION_MONTH_DAYS } from '../config/domain';

export function manilaTodayISO() {
  // Dev/demo override so the UI timeline can stay in lock-step with the
  // backend's PERFORMA_TODAY. Read per call; unset in production → real clock.
  const override = import.meta.env?.VITE_PERFORMA_TODAY;
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

// Parse an absolute instant from an API datetime. The backend stores UTC
// (models._utcnow / func.now()) and SQLite strips tzinfo, so an offset-less ISO
// string is UTC — never browser-local. Date-only strings stay calendar dates.
export function parseInstant(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseDateOnly(text);
  const hasOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  return new Date(hasOffset ? text : `${text}Z`);
}

export function manilaToday() {
  return parseDateOnly(manilaTodayISO());
}

// "Monday · Oct 12, 2026" for today in Asia/Manila (page context lines).
export function manilaTodayLabel() {
  const anchor = new Date(`${manilaTodayISO()}T12:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
  }).format(anchor);
  return `${weekday} · ${formatManilaDay(anchor)}`;
}

export function daysElapsed(startDate) {
  const start = parseDateOnly(startDate);
  if (!start) return 0;
  const now = manilaToday();
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
}

// Whole days from today (Asia/Manila) until a calendar date; negative when past.
export function daysUntil(value) {
  const target = value instanceof Date ? value : parseDateOnly(value);
  if (!target) return null;
  const now = manilaToday();
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

// Add whole days to a calendar date without UTC drift (shared day-math helper).
export function addDays(value, days) {
  const base = value instanceof Date ? value : parseDateOnly(value);
  if (!base) return null;
  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

// Statutory milestone date = start date + N days (Day-0 convention).
export function milestoneDate(startDate, day) {
  return addDays(startDate, day);
}

// 1-based probation month for a day count. Mirrors backend
// domain.month_number_for = max(1, days // 30 + 1).
export function monthNumberFor(days) {
  return Math.max(1, Math.floor((Number(days) || 0) / PROBATION_MONTH_DAYS) + 1);
}

// Live wall-clock time in Asia/Manila (24h, HH:MM:SS). Display only.
export function formatManilaClock(date = new Date()) {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Asia/Manila calendar-day key (YYYY-MM-DD) for grouping logs by day.
export function manilaDateKey(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parseInstant(value));
}

// Friendly Asia/Manila day label for a grouped log, e.g. "Oct 2, 2026".
export function formatManilaDay(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseInstant(value));
}

// Asia/Manila time only, e.g. "02:22 PM". Display only.
export function formatManilaTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(parseInstant(value));
}

// Compact month + day, no year — for dense tables (e.g. "Oct 13").
export function formatDayMonth(value) {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : parseDateOnly(value) || parseInstant(value);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return '';
  }
}

export function formatDate(value, { withTime = false, seconds = true } = {}) {
  if (!value) return 'N/A';
  try {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    // Calendar date (a Date used as a day, or a YYYY-MM-DD string): no tz shift.
    const isCalendarDate =
      typeof value === 'string'
        ? /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
        : value instanceof Date && !withTime;
    if (isCalendarDate) {
      const date = value instanceof Date ? value : parseDateOnly(value);
      return date.toLocaleDateString('en-US', options);
    }
    // Instant (API datetime string, or an explicit Date with a time): render in
    // Asia/Manila. Offset-less strings are UTC — the backend stores UTC and
    // SQLite drops tzinfo, so parsing them as browser-local drifted by the offset.
    const date = parseInstant(value);
    if (!date) return String(value);
    if (withTime) {
      return date.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        ...options,
        hour: '2-digit',
        minute: '2-digit',
        ...(seconds ? { second: '2-digit' } : {}),
        hour12: true,
      });
    }
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', ...options });
  } catch {
    return String(value);
  }
}
