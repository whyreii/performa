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
  printSheet = false,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'space-y-6',
    animate ? 'animate-in fade-in duration-150' : '',
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
