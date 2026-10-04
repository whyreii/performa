import React from 'react';

// Base surface: hairline border, no drop shadow. This is the single definition
// of the rounded card/panel look (docs/SLOP_AUDIT.md Phase C). Card and the
// standalone panels (login, 403, error boundary, tinted banners) render through
// this so the surface string exists once.
const TONE = {
  surface: 'bg-surface',
  warn: 'bg-warn/6',
};

export default function Surface({
  as: Tag = 'div',
  tone = 'surface',
  elevated = false,
  padded = false,
  className = '',
  children,
  ...props
}) {
  const base = `border border-line rounded-float ${TONE[tone] || TONE.surface}`;
  return (
    <Tag
      className={`${base}${elevated ? ' shadow-pop' : ''}${padded ? ' p-6' : ''}${
        className ? ` ${className}` : ''
      }`}
      {...props}
    >
      {children}
    </Tag>
  );
}
