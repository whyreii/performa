import React from 'react';

// Shared empty state. Replaces the block duplicated ~9× (SLOP_AUDIT §3).
// Says what happened (title + body) and can offer a next step (action).
export default function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`py-10 text-center space-y-2${className ? ` ${className}` : ''}`}>
      {Icon && <Icon className="w-9 h-9 text-ink-3/40 mx-auto" aria-hidden="true" />}
      <h3 className="text-base font-medium text-ink">{title}</h3>
      {children && <p className="text-12 text-ink-3">{children}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
