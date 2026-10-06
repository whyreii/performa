import React from 'react';

// Segmented tab control with correct tablist/tab semantics. Replaces the two
// hand-rolled tablists (Employees, UserManagement) and the sandbox patterns.
export default function Tabs({ tabs = [], value, onChange, ariaLabel }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex p-1 rounded-nav bg-hover border border-line"
    >
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(tab.id)}
            className={`px-3 py-1.5 rounded-ctl text-12 font-medium transition-colors ${
              selected ? 'bg-surface text-ink font-semibold' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className="ml-1.5 font-num text-12 text-ink-3">({tab.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
