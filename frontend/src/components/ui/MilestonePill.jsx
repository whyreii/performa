import React from 'react';
import Badge from './Badge';
import { milestoneStage, formatProbationDay, TONE_VARIANT } from '../../utils/status';

// The employee's current probation stage as a compact chip. Labels come from the
// single shared stage source (utils/status.js, manuscript-grounded) — never
// re-worded here. A terminal decision supersedes the live day clock.
export default function MilestonePill({ daysElapsed = 0, status = 'active', className = '' }) {
  const stage = milestoneStage(daysElapsed, status);

  if (stage.key === 'regularized') {
    return (
      <Badge variant="ok" className={className}>
        Regularized
      </Badge>
    );
  }
  if (stage.key === 'terminated') {
    return (
      <Badge variant="neutral" className={className}>
        Terminated
      </Badge>
    );
  }
  if (stage.key === 'ok') {
    return (
      <Badge variant="neutral" className={className}>
        <span className="font-num">{formatProbationDay(daysElapsed)}</span>
      </Badge>
    );
  }

  // warn / notice / bad / past — the chip carries the stage; tone = status.
  return (
    <Badge variant={TONE_VARIANT[stage.tone]} className={className}>
      {stage.label}
    </Badge>
  );
}
