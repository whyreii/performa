import React from 'react';

// iMac-concept page head: a kick eyebrow, the page title (the page's single
// visible h1), and a mono meta line, closed by a hairline. The shell toolbar
// keeps the nav label; this is the page's own title block. Used by pages that
// render the concept head in the body (docs/LAYOUT_GRAMMAR.md).
export default function PageHead({ kick, title, meta, actions, className = '' }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 pb-4 border-b border-line${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="min-w-0">
        {kick ? <div className="text-12 text-ink-3">{kick}</div> : null}
        <h1 className="text-22 font-semibold tracking-tight text-ink mt-1">{title}</h1>
        {meta ? <div className="text-12 text-ink-3 font-num mt-1.5">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </div>
  );
}
