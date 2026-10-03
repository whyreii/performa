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
    accent: 'bg-accent/8 text-accent border border-transparent',
    ok: 'bg-ok/8 text-ok border border-transparent',
    warn: 'bg-warn/8 text-warn border border-transparent',
    notice: 'bg-notice/8 text-notice border border-transparent',
    bad: 'bg-bad/8 text-bad border border-transparent',
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
