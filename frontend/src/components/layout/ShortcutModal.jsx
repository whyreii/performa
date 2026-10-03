import React from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Keyboard, X, Search, Printer, Sliders, Navigation, ShieldCheck } from 'lucide-react';

export default function ShortcutModal({ isOpen, onClose }) {
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Global Navigation & Commands',
      icon: Navigation,
      items: [
        { keys: ['Ctrl', 'K'], label: 'Open Command Palette & Global Search' },
        { keys: ['?'], label: 'Open / Close this Keyboard Shortcut Guide' },
        { keys: ['Esc'], label: 'Dismiss open modal, dialog, or drawer' },
      ],
    },
    {
      title: 'Compliance & Export Utilities',
      icon: ShieldCheck,
      items: [
        { keys: ['Ctrl', 'P'], label: 'Print DOLE Evidentiary Audit Exhibit' },
        { keys: ['Click'], label: 'One-Click Copy Article 296 Legal Summary' },
      ],
    },
    {
      title: 'Accessibility & Keyboard Traversal',
      icon: Sliders,
      items: [
        { keys: ['Tab'], label: 'Navigate forward through interactive elements' },
        { keys: ['Shift', 'Tab'], label: 'Navigate backward through interactive elements' },
        { keys: ['Enter'], label: 'Activate focused control, button, or link' },
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-float shadow-pop p-6 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-ctl bg-accent/10 text-accent">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shortcut-modal-title" className="text-base font-semibold text-ink">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-ink-3">
                Power-user hotkeys for swift platform navigation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts modal"
            className="p-1.5 text-ink-3 hover:text-ink rounded-ctl hover:bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div className="space-y-4">
          {shortcutGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.title} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                  <GroupIcon className="w-3.5 h-3.5 text-accent" />
                  <span>{group.title}</span>
                </div>

                <div className="rounded-field border border-line bg-hover/40 divide-y divide-line overflow-hidden">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="text-ink-2">{item.label}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        {item.keys.map((k) => (
                          <kbd
                            key={k}
                            className="px-2 py-0.5 font-mono text-[11px] font-semibold text-ink bg-surface border border-line rounded shadow-xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-line flex items-center justify-between text-[11px] text-ink-3">
          <span>Performa Capstone · WCAG 2.1 AA Compliant</span>
          <span className="font-mono">Press Esc to exit</span>
        </div>
      </div>
    </div>
  );
}
