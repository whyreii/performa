import React from 'react';

// Canonical section header (layout grammar): a single line — title left, meta
// (subtitle + note) right — closed by a hairline rule. This is the iMac
// concept's quiet section label. The single definition of a section heading
// across the app — pages must not define their own CardHead/SectionHead. See
// docs/LAYOUT_GRAMMAR.md; enforced by backend/tests/guardrails/test_layout_grammar.py.
export default function SectionHead({ title, subtitle, note, className = '' }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 pb-2 mb-3 border-b border-line${
        className ? ` ${className}` : ''
      }`}
    >
      <h2 className="min-w-0 truncate text-12 font-medium text-ink-2">{title}</h2>
      {subtitle || note ? (
        <div className="flex flex-none items-baseline gap-3">
          {subtitle ? <span className="truncate text-12 text-ink-3">{subtitle}</span> : null}
          {note ? <span className="flex-none text-12 text-ink-3">{note}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
