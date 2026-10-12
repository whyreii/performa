import React from 'react';

// The app's page grid (layout grammar) — one container, twelve columns, one
// gutter, defined ONCE so every page's column lines are identical and nothing
// shifts when you navigate. See docs/LAYOUT_GRAMMAR.md; a page must not declare
// its own page-level grid (enforced by
// backend/tests/guardrails/test_layout_grammar.py).
//
// Geometry: max-w 1120 - px-8 (64) = 1056 content, 12 tracks, 11 x 24px gutters
// -> 66px columns.  At a 1920px viewport: col 1 starts at 432, col 12 ends 1488.
//
// Rows use `grid-cols-subgrid` + `column-gap: normal` so they inherit the
// parent's tracks AND gutters.  Do NOT re-declare `grid-cols-12 gap-x-6` per
// row: that only appears to align, and an own `gap-*` on a row silently
// overrides the inherited gutter (measured: brand 430px vs form 418px).

// Literal class strings (Tailwind scans source text — dynamic names won't build).
const SPAN = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
};

const START = {
  1: 'lg:col-start-1',
  2: 'lg:col-start-2',
  3: 'lg:col-start-3',
  4: 'lg:col-start-4',
  5: 'lg:col-start-5',
  6: 'lg:col-start-6',
  7: 'lg:col-start-7',
  8: 'lg:col-start-8',
  9: 'lg:col-start-9',
  10: 'lg:col-start-10',
  11: 'lg:col-start-11',
  12: 'lg:col-start-12',
};

const cx = (...parts) => parts.filter(Boolean).join(' ');

export default function PageGrid({ container = false, className = '', children, ...props }) {
  return (
    <div
      className={cx(
        // Authed pages already sit inside AppShell's 1120 container, so they use
        // the grid alone. Standalone pages (sign-in) pass `container` to own the
        // same 1120 + px-4/6/8 geometry.
        container && 'w-full max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8',
        'lg:grid lg:grid-cols-12 lg:gap-x-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// A full-width row that shares the parent grid's tracks and gutters.
export function Row({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag
      className={cx('lg:col-span-12 lg:grid lg:grid-cols-subgrid lg:gap-x-[normal]', className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

// A placed item on the shared tracks: <Col span={5}> or <Col span={6} start={7}>.
export function Col({ as: Tag = 'div', span, start, className = '', children, ...props }) {
  return (
    <Tag className={cx(span ? SPAN[span] : null, start ? START[start] : null, className)} {...props}>
      {children}
    </Tag>
  );
}
