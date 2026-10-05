import React from 'react';

export default function StatusDot({
  status = 'active',
  label,
  pulse = false,
  size = 'md',
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

  const sizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
  };

  const dotColor = statusColors[status?.toLowerCase()] || statusColors.none;
  const dotSize = sizes[size] || sizes.md;
  const isPulsing = pulse || status === 'critical' || status === 'bad';

  return (
    <div className={`inline-flex items-center gap-2 text-12 font-medium text-ink ${className}`}>
      <span className={`relative flex ${dotSize}`}>
        {isPulsing && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${dotColor}`} />
      </span>
      {label && <span className="capitalize">{label}</span>}
    </div>
  );
}
