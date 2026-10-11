import React from 'react';
import PageHeader from './PageHeader';

// Canonical page wrapper. Owns the per-page vertical rhythm (24px), the page
// transition, and the standard PageHeader. It deliberately does NOT define
// max-width or padding: the "gallery wall" lives once in AppShell.jsx, which
// wraps both this content and the loading skeleton. Every routed page must use
// this (docs/SLOP_AUDIT.md; enforced by
// backend/tests/guardrails/test_page_wrapper.py).
//
// `reveal` (default) runs a single whole-page transition on mount — one
// composited layer, not one per section — and its opacity never drops below
// 0.85 so content is never hidden/blank even if the animation is throttled.
// The app's Reduce-motion setting and prefers-reduced-motion collapse it.
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
    reveal ? 'page-enter' : '',
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
