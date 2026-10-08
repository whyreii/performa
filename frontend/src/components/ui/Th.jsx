import React from 'react';

// Standard data-table header cell (AGENTS.md §1.9 — one source for the header
// look). Single source for the column-header font (IBM Plex Mono, uppercase,
// tracked, ink-3) and for the sortable-header affordance (click target, ▲/▼
// indicator, aria-sort). Pass `sortKey` + `onSort` to make the column sortable;
// `activeKey`/`dir` reflect the current sort. Padding is context-specific, so
// pass it via `className` (e.g. "py-2.5 px-4").
export default function Th({
  children,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
  className = '',
}) {
  const sortable = Boolean(sortKey && onSort);
  const active = sortable && activeKey === sortKey;
  const ariaSort = sortable
    ? active
      ? dir === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'
    : undefined;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`font-mono text-12 font-medium uppercase tracking-wider text-ink-3 ${
        align === 'right' ? 'text-right' : ''
      } ${className}`}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="inline-flex items-center gap-1 uppercase transition-colors hover:text-ink"
        >
          {children}
          <span aria-hidden="true">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}
