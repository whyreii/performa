import React from 'react';

// Standard data-table header cell (AGENTS.md §1.9 — one source for the header
// look). Single source for the column-header look (sentence case, ink-3) and for
// the sortable-header affordance (click target, ↑/↓ indicator, aria-sort). Pass
// `sortKey` + `onSort` to make the column sortable; `activeKey`/`dir` reflect the
// current sort. Padding is context-specific, so pass it via `className`.
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
      className={`text-12 font-normal text-ink-3 ${
        align === 'right' ? 'text-right' : ''
      } ${className}`}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${
            active ? 'text-ink' : ''
          }`}
        >
          {children}
          {active ? <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span> : null}
        </button>
      ) : (
        children
      )}
    </th>
  );
}
