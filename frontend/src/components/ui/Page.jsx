import React from 'react';
import PageHeader from './PageHeader';

// Canonical page wrapper. Owns the per-page vertical rhythm (24px) and the
// fade-in, plus the standard PageHeader. It deliberately does NOT define
// max-width or padding: the "gallery wall" lives once in AppShell.jsx, which
// wraps both this content and the loading skeleton. Every routed page must use
// this (docs/SLOP_AUDIT.md; enforced by backend/tests/guardrails/test_page_wrapper.py).
export default function Page({
  kicker,
  title,
  subtitle,
  actions,
  header = true,
  headerClassName = '',
  aboveHeader,
  animate = true,
  reveal = true,
  printSheet = false,
  className = '',
  children,
  ...props
}) {
  // `reveal` (default) staggers the page's direct children in on mount (React
  // Bits Animated Content); it supersedes the whole-page fade so the two never
  // double up. Opt out with `reveal={false}`. Both collapse to an instant
  // appearance under prefers-reduced-motion or the app's Reduce-motion setting.
  const classes = [
    'space-y-6',
    reveal ? 'reveal' : animate ? 'animate-in fade-in duration-150' : '',
    printSheet ? 'print-sheet' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {aboveHeader}
      {header && (
        <PageHeader
          kicker={kicker}
          title={title}
          subtitle={subtitle}
          actions={actions}
          className={headerClassName}
        />
      )}
      {children}
    </div>
  );
}
