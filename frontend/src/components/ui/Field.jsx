import React from 'react';
import Label from './Label';

// Shared control class strings — the single source for input/select/textarea
// styling. Replaces the class literal duplicated across ~9 files (SLOP_AUDIT §3).
export const inputClass =
  'w-full h-8 px-2.5 border border-glass-line rounded-ctl bg-glass text-ink placeholder:text-ink-3/60 text-12 focus:outline-none focus:border-accent transition-colors';

export const textareaClass =
  'w-full p-2.5 text-12 border border-glass-line rounded-ctl bg-glass text-ink placeholder:text-ink-3/60 focus:outline-none focus:border-accent transition-colors';

export function Field({ id, label, hint, children }) {
  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}
      {children}
      {hint && <p className="text-12 text-ink-3 mt-1">{hint}</p>}
    </div>
  );
}

export default Field;
