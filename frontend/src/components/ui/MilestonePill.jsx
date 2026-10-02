import React from 'react';
import Badge from './Badge';

export default function MilestonePill({
  daysElapsed = 0,
  totalDays = 180,
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
  if (daysElapsed > 180) {
    return (
      <Badge variant="bad" className={`animate-pulse ${className}`}>
        Passed 180-Day Cap (Auto-Reg)
      </Badge>
    );
  }

  if (daysElapsed >= 178) {
    return (
      <Badge variant="bad" className={`animate-pulse ${className}`}>
        Day {daysElapsed} · Day 178 Critical Action
      </Badge>
    );
  }

  if (daysElapsed >= 165) {
    return (
      <Badge variant="warn" className={className}>
        Day {daysElapsed} · Day 165 Notice Window
      </Badge>
    );
  }

  if (daysElapsed >= 150) {
    return (
      <Badge variant="warn" className={className}>
        Day {daysElapsed} · Day 150 Review Due
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" className={className}>
      <span className="font-mono">Day {daysElapsed}</span> / {totalDays}
    </Badge>
  );
}
