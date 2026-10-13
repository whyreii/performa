import React from 'react';

// Canonical form-field label — the single source for the label above a control
// (AGENTS.md §1.9 / docs/LAYOUT_GRAMMAR.md: one source per element type). Every
// field label must use this; a hand-rolled `<label>` with its own text size is
// how the labels drifted (Login's "Password" was 12px while "Work email" was
// 14px). Enforced by backend/tests/guardrails/test_form_labels.py.
//
// `block` (default) adds the stacked spacing used above standalone controls;
// pass `block={false}` when the label sits inline in a flex row (e.g. next to a
// "Forgot password?" link) so it does not add a second bottom margin.
export default function Label({ htmlFor, children, block = true, className = '' }) {
  const base = `text-12 font-medium text-ink-2${block ? ' block mb-1' : ''}`;
  return (
    <label htmlFor={htmlFor} className={`${base}${className ? ` ${className}` : ''}`}>
      {children}
    </label>
  );
}
