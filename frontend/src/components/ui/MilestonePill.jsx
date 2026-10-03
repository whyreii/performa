import React from 'react';
import Badge from './Badge';
import {
  PROBATION_DAYS,
  MILESTONE_CRITICAL,
  MILESTONE_NOTICE,
  MILESTONE_REVIEW,
} from '../../config/domain';

export default function MilestonePill({
  daysElapsed = 0,
  totalDays = PROBATION_DAYS,
  status = 'active',
  className = '',
}) {
  const normStatus = (status || 'active').toLowerCase();

  if (normStatus === 'regularized') {
    return (
      <Badge variant="ok" className={className}>
        Regularized
      </Badge>
    );
  }

  if (normStatus === 'terminated') {
    return (
      <Badge variant="neutral" className={className}>
        Terminated
      </Badge>
    );
  }

  // Article 296 statutory milestone thresholds
  if (daysElapsed > PROBATION_DAYS) {
    return (
      <Badge variant="bad" className={`animate-pulse ${className}`}>
        Passed 180-Day Cap (Auto-Reg)
      </Badge>
    );
  }

  if (daysElapsed >= MILESTONE_CRITICAL) {
    return (
      <Badge variant="bad" className={`animate-pulse ${className}`}>
        Day {daysElapsed} · Day {MILESTONE_CRITICAL} Critical Action
      </Badge>
    );
  }

  if (daysElapsed >= MILESTONE_NOTICE) {
    return (
      <Badge variant="notice" className={className}>
        Day {daysElapsed} · Day {MILESTONE_NOTICE} Notice Window
      </Badge>
    );
  }

  if (daysElapsed >= MILESTONE_REVIEW) {
    return (
      <Badge variant="warn" className={className}>
        Day {daysElapsed} · Day {MILESTONE_REVIEW} Review Due
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" className={className}>
      <span className="font-mono">Day {daysElapsed}</span> / {totalDays}
    </Badge>
  );
}
