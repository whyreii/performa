import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from '../icons';
import Label from './Label';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Format a local Date as the value contract 'YYYY-MM-DD' (no timezone drift).
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

const parseISO = (value) => {
  if (!value || typeof value !== 'string') return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const display = (value) => {
  const d = parseISO(value);
  return d ? `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}` : '';
};

// A calendar picker that matches the app's controls (same field styling as
// TextField, same surface/border tokens as the popovers). Value contract is an
// ISO 'YYYY-MM-DD' string, matching the API.
export default function DatePicker({
  id,
  label,
  value = '',
  onChange,
  ariaLabel = 'Choose date',
  placeholder = 'Select a date',
  disabled = false,
  error,
  hint,
  className = '',
}) {
  const selected = parseISO(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected || new Date());
  const rootRef = useRef(null);

  const today = useMemo(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Keep the visible month in sync when the value changes.
  useEffect(() => {
    const d = parseISO(value);
    if (d) setView(d);
  }, [value]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const pick = (day) => {
    onChange?.(toISO(new Date(year, month, day)));
    setOpen(false);
  };

  const goMonth = (delta) => setView(new Date(year, month + delta, 1));
  const goToday = () => setView(new Date(today.y, today.m, 1));

  const isSelected = (day) =>
    selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === day;
  const isToday = (day) => year === today.y && month === today.m && day === today.d;

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className} ref={rootRef}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="relative w-full h-8 pl-8 pr-2.5 text-left border border-glass-line rounded-ctl bg-glass text-ink text-12 focus:outline-none focus:border-accent transition-colors disabled:opacity-40"
      >
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
        <span className={value ? 'text-ink' : 'text-ink-3/60'}>
          {value ? display(value) : placeholder}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="mt-1.5 w-64 p-3 rounded-float border border-line bg-surface shadow-pop animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => goMonth(-1)}
              className="w-7 h-7 grid place-items-center rounded-ctl text-ink-3 hover:text-ink hover:bg-hover transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="text-14 font-medium text-ink rounded-ctl px-2 py-1 hover:bg-hover transition-colors"
              title="Jump to this month"
            >
              {MONTHS[month]} {year}
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => goMonth(1)}
              className="w-7 h-7 grid place-items-center rounded-ctl text-ink-3 hover:text-ink hover:bg-hover transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="h-7 grid place-items-center text-12 text-ink-3">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const sel = isSelected(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={`${MONTHS[month]} ${day}, ${year}`}
                  aria-pressed={sel}
                  onClick={() => pick(day)}
                  className={`h-7 w-7 mx-auto grid place-items-center rounded-ctl text-12 transition-colors ${
                    sel
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : isToday(day)
                      ? 'ring-1 ring-accent text-ink hover:bg-hover'
                      : 'text-ink hover:bg-hover'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => {
                const n = new Date();
                onChange?.(toISO(n));
                setOpen(false);
              }}
              className="text-12 font-medium text-accent hover:underline"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                onChange?.('');
                setOpen(false);
              }}
              className="text-12 text-ink-3 hover:text-ink"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-12 text-bad mt-1">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-12 text-ink-3 mt-1">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
