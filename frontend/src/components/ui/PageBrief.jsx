import React from 'react';
import Card from './Card';
import { TONE_TEXT } from '../../utils/status';

// Canonical page brief (layout grammar): the plain-language lead for a page or
// role lens — one sentence, the one figure it rests on, and the one next step.
// Everything below the brief is evidence for it. See docs/LAYOUT_GRAMMAR.md.
//
// - eyebrow: small label above the sentence (e.g. "Regularization decision").
// - figure:  the 30px figure the sentence rests on (optional).
// - tone:    statutory tone for the figure (colour = status).
// - lead:    the sentence itself, in plain language.
// - badge:   optional status chip beside the sentence.
// - note:    the "what it means / what's next" line.
// - actions: the one primary action (plus at most one secondary).
export default function PageBrief({
  eyebrow,
  figure,
  tone,
  lead,
  badge,
  note,
  actions,
  className = '',
}) {
  return (
    <Card flat padded={false} className={className}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <div className="text-12 text-ink-3">{eyebrow}</div> : null}
          <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap mt-1">
            {figure != null && figure !== '' ? (
              <span
                className={`text-30 font-semibold font-num ${tone ? TONE_TEXT[tone] : 'text-ink'}`}
              >
                {figure}
              </span>
            ) : null}
            <span className="text-16 text-ink">{lead}</span>
            {badge || null}
          </div>
          {note ? <p className="text-14 text-ink-2 mt-2 leading-relaxed">{note}</p> : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        ) : null}
      </div>
    </Card>
  );
}
