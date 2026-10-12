import React from 'react';
import {
  MILESTONE_REVIEW,
  MILESTONE_NOTICE,
  MILESTONE_CRITICAL,
  PROBATION_DAYS,
} from '../../config/domain';
import { TONE_TEXT } from '../../utils/status';

// The statutory day rail (docs/LAYOUT_GRAMMAR.md). Pure geometry so the
// milestone windowing is testable: before Day 150 the rail is the full
// 0–180-day term; from Day 150 it zooms into the decision window (150–180),
// where the notice and critical milestones actually fire.
export function railGeometry(day) {
  const d = Number(day) || 0;
  const zoom = d >= MILESTONE_REVIEW;
  const start = zoom ? MILESTONE_REVIEW : 0;
  const span = PROBATION_DAYS - start;
  const pct = (x) => Math.min(100, Math.max(0, ((x - start) / span) * 100));
  return {
    zoom,
    fill: pct(d),
    ticks: [MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL].map(pct),
    zones: [
      { key: 'warn-1', from: pct(MILESTONE_REVIEW), to: pct(MILESTONE_NOTICE) },
      { key: 'warn-2', from: pct(MILESTONE_NOTICE), to: pct(MILESTONE_CRITICAL) },
      { key: 'bad', from: pct(MILESTONE_CRITICAL), to: pct(PROBATION_DAYS) },
    ],
  };
}

// The row's rail + caption, e.g. "Day 152 · Review". `tone`/`label` come from
// utils/status (milestoneFor) — the rail never re-derives a threshold.
export default function MilestoneRail({ day, tone = 'ok', label, className = '' }) {
  const g = railGeometry(day);
  return (
    <div className={className}>
      <div className="rail" role="img" aria-label={`Day ${day} of ${PROBATION_DAYS}`}>
        {g.zones.map((z) => (
          <i
            key={z.key}
            className={`rail__zone rail__zone--${z.key}`}
            style={{ left: `${z.from}%`, width: `${Math.max(0, z.to - z.from)}%` }}
          />
        ))}
        <i className="rail__fill" style={{ width: `${g.fill}%` }} />
        {g.ticks.map((t, i) => (
          <i key={i} className="rail__tick" style={{ left: `${t}%` }} />
        ))}
        <i className={`rail__dot rail__dot--${tone}`} style={{ left: `${g.fill}%` }} />
      </div>
      {label ? (
        <div className="mt-3.5 text-12 text-ink-3">
          <b className="font-num font-medium text-ink-2">Day {day}</b>
          {' · '}
          <span className={tone === 'ok' ? '' : `font-medium ${TONE_TEXT[tone]}`}>{label}</span>
        </div>
      ) : null}
    </div>
  );
}
