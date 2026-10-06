import React from 'react';

// Canonical page header. Constant height across pages: the kicker row and a
// two-line subtitle are always reserved, so switching routes never shifts the
// content below (docs/SLOP_AUDIT.md Phase C; measured in Phase 0).
// - title: one line, truncated.
// - subtitle: clamped to two lines; the full text stays available via title=.
// - kicker: mono, ink-3 (accent is identity only, not decoration).
export default function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className = '',
  ...props
}) {
  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line${
        className ? ` ${className}` : ''
      }`}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <div className="font-num text-12 font-medium text-ink-3 mb-1 min-h-[18px] truncate">
          {kicker || ''}
        </div>
        <h1
          className="text-22 sm:text-30 font-semibold tracking-tight text-ink truncate"
          title={typeof title === 'string' ? title : undefined}
        >
          {title}
        </h1>
        <p
          className="text-14 text-ink-2 mt-1 leading-snug line-clamp-2 min-h-[2.8em]"
          title={typeof subtitle === 'string' ? subtitle : undefined}
        >
          {subtitle || ''}
        </p>
      </div>

      <div className="flex items-center gap-3 min-h-[40px] sm:min-h-0 sm:flex-none">
        {actions}
      </div>
    </header>
  );
}
