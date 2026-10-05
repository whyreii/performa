import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from '../icons';

// Progressive disclosure for a flat record-sheet section (accordion pattern:
// heading > toggle button > body). The body stays in the DOM but is hidden when
// collapsed; @media print forces it open so legal reports stay complete.
export default function Disclosure({ title, subtitle, meta, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${useId()}-body`;

  return (
    <section className="rec-block disclosure">
      <h2 className="disclosure__h">
        <button
          type="button"
          className="disclosure__hd"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="disclosure__title">
            <span className="disclosure__t">{title}</span>
            {subtitle && <span className="disclosure__s">{subtitle}</span>}
          </span>
          <span className="disclosure__aside">
            {meta && <span className="disclosure__meta">{meta}</span>}
            <span className="disclosure__action">
              {open ? 'Show less' : 'Show more'}
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </span>
        </button>
      </h2>
      <div id={bodyId} className="disclosure__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
