import React from 'react';

export default function StatusDot({
  status = 'active',
  label,
  pulse = false,
  className = '',
}) {
  const statusColors = {
    active: 'bg-ok',
    good: 'bg-ok',
    warning: 'bg-warn',
    warn: 'bg-warn',
    critical: 'bg-bad',
    bad: 'bg-bad',
    regularized: 'bg-accent',
    terminated: 'bg-ink-3',
    none: 'bg-ink-3/40',
  };

  const dotColor = statusColors[status?.toLowerCase()] || statusColors.none;
  const isPulsing = pulse || status === 'critical' || status === 'bad';

  return (
    <div className={`inline-flex items-center gap-2 text-xs font-medium text-ink ${className}`}>
      <span className="relative flex h-2 w-2">
        {isPulsing && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      {label && <span className="capitalize">{label}</span>}
    </div>
  );
}
