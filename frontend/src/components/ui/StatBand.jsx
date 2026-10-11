import React from 'react';
import { TONE_BG, TONE_TEXT } from '../../utils/status';

// Canonical stat band (layout grammar): one hairline-divided row of figures.
// Each cell is a tone dot + label, a figure, and a caption. The tone is a
// statutory tone (milestoneTone / scoreTone) — colour = status, never
// decoration. `size` steps a cell's figure down: 'lead' (30px) for the page's
// headline figure, 'base' (16px) for the supporting cells beside it.
//
// cells: [{ label, value, caption?, tone?, size? }]
export default function StatBand({ cells = [], className = '' }) {
  if (!cells.length) return null;
  return (
    <div
      className={`grid divide-x divide-line border-y border-line${
        className ? ` ${className}` : ''
      }`}
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((cell) => {
        const size = cell.size === 'base' ? 'text-16' : 'text-30';
        const valueTone = cell.tone ? TONE_TEXT[cell.tone] : 'text-ink';
        return (
          <div key={cell.label} className="px-5 py-4 min-w-0">
            <div className="flex items-center gap-2 text-12 text-ink-3">
              {cell.tone ? (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${TONE_BG[cell.tone]}`}
                  aria-hidden="true"
                />
              ) : null}
              <span className="truncate">{cell.label}</span>
            </div>
            <div className={`${size} font-semibold font-num mt-2 ${valueTone}`}>
              {cell.value}
            </div>
            {cell.caption ? <div className="text-12 text-ink-2 mt-2">{cell.caption}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
