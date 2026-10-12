import React from 'react';
import { Row, Col } from './PageGrid';

// Minimal-system flat section (docs/LAYOUT_GRAMMAR.md): one 1px ink rule, a
// numbered gutter (index + one-line description), a title with an optional
// mono note, and content. No card. Sections space themselves 48px apart.
export default function Section({ index, gutter, title, note, children, className = '' }) {
  const ix = index == null ? null : String(index).padStart(2, '0');
  return (
    <Row as="section" className={`sec${className ? ` ${className}` : ''}`}>
      <Col span={2} className="text-12 text-ink-3 leading-relaxed">
        {ix ? <span className="block font-num text-12 text-ink">{ix}</span> : null}
        {gutter}
      </Col>
      <Col span={10} className="mt-4 lg:mt-0">
        {title || note ? (
          <h2 className="flex items-baseline gap-2 min-h-8 text-16 font-semibold tracking-tight text-ink">
            {title}
            {note ? (
              <span className="font-num text-12 font-normal text-ink-3">{note}</span>
            ) : null}
          </h2>
        ) : null}
        {children}
      </Col>
    </Row>
  );
}
