import React from 'react';

// Page-level dynamic grid: a wide main work surface plus a narrow context rail.
// At >= lg the rail is a sticky inspector beside the main column; below lg (and
// in print) everything stacks to a single column. It renders inside <Page>, so
// the "gallery wall" (max-width + padding, owned by AppShell) is untouched.
//
// The rail is a <div>, not an <aside>: the global print stylesheet hides
// <aside>, and page content must still print.
export default function Split({ main, aside, sticky = true, className = '' }) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 print:block${className ? ` ${className}` : ''}`}>
      <div className="lg:col-span-8 min-w-0 space-y-6">{main}</div>
      <div
        className={`lg:col-span-4 min-w-0 space-y-6 print:static${
          sticky ? ' lg:sticky lg:top-6 lg:self-start' : ''
        }`}
      >
        {aside}
      </div>
    </div>
  );
}
