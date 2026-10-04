import React from 'react';

// Canonical surface: hairline border, no drop shadow. This is the single card
// style the de-slop pass standardizes on (see docs/SLOP_AUDIT.md, Phase C).
export default function Card({ as: Tag = 'section', padded = true, className = '', children, ...props }) {
  const base = 'bg-surface border border-line rounded-float';
  return (
    <Tag className={`${base}${padded ? ' p-6' : ''}${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </Tag>
  );
}
