// Asia/Manila date helpers. Dates are treated as calendar dates (no UTC drift).

export function manilaTodayISO() {
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

export function manilaToday() {
  return parseDateOnly(manilaTodayISO());
}

export function daysElapsed(startDate) {
  const start = parseDateOnly(startDate);
  if (!start) return 0;
  const now = manilaToday();
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
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

export function formatDate(value, { withTime = false, seconds = true } = {}) {
  if (!value) return 'N/A';
  try {
    const date = withTime ? new Date(value) : parseDateOnly(value) || new Date(value);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
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
    return date.toLocaleDateString('en-US', options);
  } catch {
    return String(value);
  }
}
