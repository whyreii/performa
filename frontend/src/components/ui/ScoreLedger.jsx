import React from 'react';
import { COMPETENCY_DESCRIPTIONS } from '../../config/domain';
import { scoreTone, TONE_BG, TONE_TEXT } from '../../utils/status';

// Canonical competency scorecard: one ledger row per competency — the numeral is
// the hero, with a hairline track carrying the fixed target notch. The fill and
// the numeral share one status tone (>= target ok · >= 3.0 warn · else bad), so
// the score is encoded once, consistently. Exposes role="meter" for AT.
export default function ScoreLedger({ competencies = [] }) {
  return (
    <div className="sc-ledger">
      {competencies.map((comp) => {
        const score = Number(comp.score) || 0;
        const target = Number(comp.target) || 0;
        const tone = scoreTone(score, target);
        return (
          <div key={comp.key} className="sc-ledger__row">
            <div className="sc-ledger__l">
              <div className="sc-ledger__n">{comp.label}</div>
              <div className="sc-ledger__d">
                {COMPETENCY_DESCRIPTIONS[comp.key] || 'Statutory competency'}
              </div>
              <div
                className="sc-ledger__track"
                role="meter"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={5}
                aria-label={`${comp.label} score`}
              >
                <i style={{ left: `${(target / 5) * 100}%` }} title={`Target: ${target.toFixed(1)}`} />
                <b className={TONE_BG[tone]} style={{ width: `${(score / 5) * 100}%` }} />
              </div>
            </div>
            <span className={`sc-ledger__v ${TONE_TEXT[tone]}`}>{score.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}
