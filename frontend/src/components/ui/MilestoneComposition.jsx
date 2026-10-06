import React from 'react';

// Read-only cohort composition: one segment per statutory milestone status on a
// single hairline track, plus a plain legend. Colour = status only; there is no
// filter and no hidden interaction (Anti-Slop rule 1 and 8). The optional
// `action` slot carries a single call-to-action supplied by the caller.
const SEGMENTS = [
  { key: 'onTrack', label: 'On track', tone: 'bg-good' },
  { key: 'review', label: 'Review', tone: 'bg-warn' },
  { key: 'notice', label: 'Notice', tone: 'bg-notice' },
  { key: 'critical', label: 'Critical', tone: 'bg-bad' },
];

export default function MilestoneComposition({
  total = 0,
  onTrack = 0,
  review = 0,
  notice = 0,
  critical = 0,
  action = null,
}) {
  if (!total) return null;

  const counts = { onTrack, review, notice, critical };
  const summary = `${total} active probationers: ${onTrack} on track, ${review} review due, ${notice} notice window, ${critical} critical.`;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-12 font-semibold text-ink">Active cohort by milestone</span>
        <span className="text-12 font-num text-ink-3">{total} probationers</span>
      </div>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={summary}
      >
        {SEGMENTS.map(({ key, tone }) =>
          counts[key] > 0 ? (
            <span
              key={key}
              data-segment={key}
              className={`h-full ${tone}`}
              style={{ width: `${(counts[key] / total) * 100}%` }}
            />
          ) : null
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-12 text-ink-2">
          {SEGMENTS.map(({ key, label, tone }) => (
            <li key={key} className="inline-flex items-center gap-1.5">
              <i className={`h-2.5 w-2.5 rounded-sm ${tone}`} />
              <span>{label}</span>
              <b className="font-num font-semibold text-ink">{counts[key]}</b>
            </li>
          ))}
        </ul>
        {action}
      </div>
    </div>
  );
}
