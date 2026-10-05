import React from 'react';

// Shared control class strings — the single source for input/select/textarea
// styling. Replaces the class literal duplicated across ~9 files (SLOP_AUDIT §3).
export const inputClass =
  'w-full h-10 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-14 focus:outline-none focus:border-accent transition-colors';

// Select control. No `w-full` so toolbar filters can stay auto-width; callers
// add `w-full` for form fields.
export const selectClass =
  'h-10 px-3 border border-line rounded-field bg-transparent text-ink text-14 focus:outline-none focus:border-accent transition-colors cursor-pointer';

export const textareaClass =
  'w-full p-3 text-14 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent transition-colors';

export function Field({ id, label, hint, children }) {
  return (
    <div>
      {label && (
        <label className="block text-12 font-medium text-ink-2 mb-1" htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-12 text-ink-3 mt-1">{hint}</p>}
    </div>
  );
}

export default Field;
