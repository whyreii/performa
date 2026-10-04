import React from 'react';

// A label/value row — the ledger alternative to a bordered stat tile.
// No box: hairline separator only. (SLOP_AUDIT §4 "boxed stat tiles".)
const TONE = {
  muted: 'text-ink-3',
  warn: 'text-warn',
  notice: 'text-notice',
  bad: 'text-bad',
  good: 'text-good',
};

export default function StatRow({ label, value, tone, mono = true, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-line last:border-b-0">
      <span className={`text-14 ${tone ? TONE[tone] || 'text-ink-2' : 'text-ink-2'}${strong ? ' font-semibold' : ''}`}>
        {label}
      </span>
      <span className={`text-14 text-ink${mono ? ' font-mono' : ''}${strong ? ' font-semibold' : ''}`}>
        {value}
      </span>
    </div>
  );
}
