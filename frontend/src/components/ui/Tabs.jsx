import React, { useRef } from 'react';

// Segmented single-select filter. The control filters the same list, so a
// radiogroup (not a tablist) is the correct pattern — there is no tabpanel.
// Roving tabindex + Arrow / Home / End keyboard navigation.
export default function Tabs({ tabs = [], value, onChange, ariaLabel }) {
  const refs = useRef([]);
  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.id === value));

  const moveTo = (index) => {
    const clamped = (index + tabs.length) % tabs.length;
    refs.current[clamped]?.focus();
    onChange?.(tabs[clamped].id);
  };

  const onKeyDown = (event, index) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveTo(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTo(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveTo(tabs.length - 1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-full border border-glass-line"
    >
      {tabs.map((tab, index) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`inline-flex items-center h-8 px-3.5 text-12 font-medium transition-colors ${
              selected ? 'bg-accent text-accent-foreground font-semibold' : 'text-ink-2 hover:bg-hover hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className="ml-1.5 font-num text-12 opacity-70">({tab.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
