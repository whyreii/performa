import React from 'react';
import Card from './Card';
import SectionHead from './SectionHead';

// Canonical section (layout grammar): a Card with a SectionHead. Every content
// section on a page renders through this so titles/subtitles/notes and padding
// are identical everywhere. See docs/LAYOUT_GRAMMAR.md.
export default function SectionCard({
  title,
  subtitle,
  note,
  flat = false,
  className = '',
  children,
  ...props
}) {
  return (
    <Card flat={flat} className={`p-5${className ? ` ${className}` : ''}`} {...props}>
      {title ? <SectionHead title={title} subtitle={subtitle} note={note} /> : null}
      {children}
    </Card>
  );
}
