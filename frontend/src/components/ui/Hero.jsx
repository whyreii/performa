import React from 'react';
import { Row, Col } from './PageGrid';

// Minimal-system page hero (docs/LAYOUT_GRAMMAR.md): the page's context (left,
// holds the single h1), one figure + its plain-language label (center), and the
// next step (right). Replaces PageHeader on converted pages; the figure is the
// only place `text-hero` is used.
export default function Hero({ title, context, figure, label, side, className = '' }) {
  return (
    <Row className={`pt-6 pb-12 items-end${className ? ` ${className}` : ''}`}>
      <Col span={2} className="text-12 text-ink-2 leading-relaxed lg:self-start">
        <h1 className="text-12 font-medium text-ink">{title}</h1>
        {context ? <div className="mt-1.5">{context}</div> : null}
      </Col>
      <Col span={6} start={3} className="mt-8 lg:mt-0">
        <div className="text-hero font-num font-medium text-ink">{figure}</div>
        {label ? (
          <div className="text-30 font-semibold tracking-tight text-ink mt-5">{label}</div>
        ) : null}
      </Col>
      {side ? (
        <Col span={4} start={9} className="mt-8 lg:mt-0">
          {side}
        </Col>
      ) : null}
    </Row>
  );
}
