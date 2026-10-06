import React from 'react';
import {
  PROBATION_DAYS,
  MILESTONE_REVIEW,
  MILESTONE_NOTICE,
  MILESTONE_CRITICAL,
} from '../../config/domain';
import { formatDate, milestoneDate, manilaTodayISO } from '../../utils/datetime';
import { TONE_TEXT } from '../../utils/status';

// Canonical 180-day timeline: a vertical docket of the statutory milestones plus
// a highlighted "Today" row and a bold "reached" milestone. One component for
// every role so the probation timeline reads the same everywhere.
export default function TimelineDocket({ startDate, day180Date, daysElapsed }) {
  const reached =
    [MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL, PROBATION_DAYS]
      .filter((m) => m <= daysElapsed)
      .pop() || null;

  const rows = [
    { day: 0, label: 'Start', tone: 'text-ink-3', date: formatDate(startDate) },
    { day: MILESTONE_REVIEW, label: 'Review', tone: TONE_TEXT.warn, date: formatDate(milestoneDate(startDate, MILESTONE_REVIEW)) },
    { day: MILESTONE_NOTICE, label: 'Notice', tone: TONE_TEXT.notice, date: formatDate(milestoneDate(startDate, MILESTONE_NOTICE)) },
    { day: MILESTONE_CRITICAL, label: 'Critical', tone: TONE_TEXT.bad, date: formatDate(milestoneDate(startDate, MILESTONE_CRITICAL)) },
    { day: PROBATION_DAYS, label: 'Deadline', tone: TONE_TEXT.bad, date: formatDate(day180Date) },
    { day: daysElapsed, label: 'Today', tone: TONE_TEXT.ok, date: formatDate(manilaTodayISO()), isToday: true },
  ].sort((a, b) => a.day - b.day);

  return (
    <ul className="docket">
      {rows.map(({ day, label, tone, date, isToday }) => (
        <li
          key={`${day}-${label}`}
          className={`docket__row${isToday ? ' is-today' : ''}${
            !isToday && day === reached && day >= MILESTONE_REVIEW ? ' is-reached' : ''
          }`}
        >
          <span className="docket__d">{day}</span>
          <span className={`docket__n ${tone}`}>{label}</span>
          <span className="docket__dt">{date}</span>
        </li>
      ))}
    </ul>
  );
}
