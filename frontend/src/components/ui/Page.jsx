import React from 'react';
import PageHeader from './PageHeader';

// Canonical page wrapper. Owns the per-page vertical rhythm (24px), the page
// transition, and the standard PageHeader. It deliberately does NOT define
// max-width or padding: the "gallery wall" lives once in AppShell.jsx, which
// wraps both this content and the loading skeleton. Every routed page must use
// this (docs/SLOP_AUDIT.md; enforced by
// backend/tests/guardrails/test_page_wrapper.py).
//
// `reveal` (default) staggers the page's direct children in on mount (React Bits
// Animated Content). The app's Reduce-motion setting and prefers-reduced-motion
// collapse it to an instant appearance (see index.css).
export default function Page({
  kicker,
  title,
  subtitle,
  actions,
  header = true,
  headerClassName = '',
  aboveHeader,
  reveal = true,
  printSheet = false,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'space-y-6',
    reveal ? 'reveal' : '',
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
