import React from 'react';

export default function ScoreMeter({
  score = 0,
  max = 5.0,
  target = 4.0,
  showLabel = false,
  showTargetMarker = true,
  className = '',
}) {
  const clampedScore = Math.max(0, Math.min(Number(score) || 0, max));
  const percent = Math.round((clampedScore / max) * 100);
  const targetPercent = Math.round((target / max) * 100);

  // Semantic color based on target and passing score threshold (3.0 is minimum pass in 5-point scale)
  let fillColor = 'bg-bad';
  let textColor = 'text-bad';

  if (clampedScore >= target) {
    fillColor = 'bg-ok';
    textColor = 'text-ok';
  } else if (clampedScore >= 3.0) {
    fillColor = 'bg-warn';
    textColor = 'text-warn';
  }

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-12 mb-1.5">
          <span className="font-num font-medium text-ink">
            {clampedScore.toFixed(1)}{' '}
            <span className="text-ink-3 font-normal text-12">/ {max.toFixed(1)}</span>
          </span>
          <span className={`font-num text-12 ${textColor}`}>
            {clampedScore >= target
              ? 'Meets target'
              : `${(target - clampedScore).toFixed(1)} below target`}
          </span>
        </div>
      )}

      {/* Meter track */}
      <div
        role="meter"
        aria-valuenow={clampedScore}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label="Competency score"
        className="relative h-2 w-full bg-hover border border-line rounded-full overflow-hidden"
      >
        {/* Progress fill */}
        <div
          className={`h-full ${fillColor} rounded-full transition-all duration-performa`}
          style={{ width: `${percent}%` }}
        />

        {/* Target tick line */}
        {showTargetMarker && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-ink/70 z-10 -translate-x-1/2"
            style={{ left: `${targetPercent}%` }}
            title={`Target: ${target.toFixed(1)}`}
          />
        )}
      </div>
    </div>
  );
}
