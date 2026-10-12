import React from 'react';
import { TONE_BG } from '../../utils/status';

// Canonical stat band (layout grammar): one hairline-divided row of figures.
// Each cell is a tone dot + label, a figure, and a caption — closed by a bottom
// rule (the iMac concept's KPI strip). The tone is a statutory tone
// (milestoneTone / scoreTone) — the dot carries status; the figure stays ink.
// `size` steps a cell's figure down: 'lead' (22px) for the page's headline
// figures, 'base' (16px) for supporting cells beside them.
//
// cells: [{ label, value, caption?, tone?, size? }]
export default function StatBand({ cells = [], className = '' }) {
  if (!cells.length) return null;
  return (
    <div
      className={`grid divide-x divide-line border-b border-line pb-5${
        className ? ` ${className}` : ''
      }`}
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((cell) => {
        const size = cell.size === 'base' ? 'text-16' : 'text-22';
        return (
          <div key={cell.label} className="min-w-0 px-5 first:pl-0 last:pr-0">
            <div className="flex items-center gap-2 text-12 text-ink-3">
              {cell.tone ? (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${TONE_BG[cell.tone]}`}
                  aria-hidden="true"
                />
              ) : null}
              <span className="truncate">{cell.label}</span>
            </div>
            <div className={`${size} font-semibold font-num mt-2 text-ink`}>{cell.value}</div>
            {cell.caption ? <div className="text-12 text-ink-3 mt-1.5">{cell.caption}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
