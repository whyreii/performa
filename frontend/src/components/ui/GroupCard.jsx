import React from 'react';
import Card from './Card';
import SectionHead from './SectionHead';

// Canonical group (layout grammar): one bordered card whose sub-sections are
// divided by hairlines — used for a page's "Full record" tier so long evidence
// reads as one document instead of a stack of equal cards. See
// docs/LAYOUT_GRAMMAR.md.
export default function GroupCard({ title, subtitle, note, className = '', children, ...props }) {
  return (
    <Card flat padded={false} className={className} {...props}>
      <SectionHead title={title} subtitle={subtitle} note={note} />
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}
