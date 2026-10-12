import React from 'react';

// Canonical section header (layout grammar): title + optional muted subtitle +
// optional right-hand note, closed by a hairline rule — the iMac concept's
// quiet section label. The single definition of a section heading across the
// app — pages must not define their own CardHead/SectionHead. See
// docs/LAYOUT_GRAMMAR.md; enforced by backend/tests/guardrails/test_layout_grammar.py.
export default function SectionHead({ title, subtitle, note, className = '' }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 pb-2 mb-3 border-b border-line${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="min-w-0">
        <h2 className="text-12 font-medium text-ink-2">{title}</h2>
        {subtitle ? <p className="text-12 text-ink-3 mt-0.5">{subtitle}</p> : null}
      </div>
      {note ? <span className="text-12 text-ink-3 text-right">{note}</span> : null}
    </div>
  );
}
