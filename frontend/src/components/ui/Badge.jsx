import React from 'react';

export default function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-full transition-colors select-none';

  const variants = {
    neutral: 'bg-hover text-ink-2 border border-line',
    accent: 'bg-accent/12 text-accent border border-accent/25',
    ok: 'bg-ok/12 text-ok border border-ok/25',
    warn: 'bg-warn/12 text-warn border border-warn/25',
    bad: 'bg-bad/12 text-bad border border-bad/25',
    hot: 'bg-accent text-accent-foreground font-semibold shadow-xs',
  };

  const sizes = {
    sm: 'text-[11px] leading-tight px-2 py-0.5 font-mono',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant] || variants.neutral} ${sizes[size] || sizes.sm} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
