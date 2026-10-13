import React from 'react';
import { inputClass } from './Field';
import Label from './Label';

// Accessible text input: label wired via htmlFor, error via aria-describedby +
// aria-invalid + role=alert. Replaces the repeated input class literal AND the
// ad-hoc label/error markup (SLOP_AUDIT Phase F, Wave 4).
export default function TextField({ id, label, error, hint, className = '', ...props }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-12 text-bad mt-1">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-12 text-ink-3 mt-1">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
