import React from 'react';
import Surface from './Surface';

// Canonical card: a padded surface. The surface itself (radius + border + bg)
// is defined once in Surface.jsx (see docs/SLOP_AUDIT.md, Phase C).
export default function Card({ as = 'section', padded = true, className = '', children, ...props }) {
  return (
    <Surface as={as} padded={padded} className={className} {...props}>
      {children}
    </Surface>
  );
}
