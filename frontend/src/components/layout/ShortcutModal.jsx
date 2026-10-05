import React from 'react';
import { Modal } from '../ui';
import { X, Search, Printer, Sliders, Navigation, ShieldCheck } from '../icons';

export default function ShortcutModal({ isOpen, onClose }) {
  const shortcutGroups = [
    {
      title: 'Global Navigation & Commands',
      icon: Navigation,
      items: [
        { keys: ['Ctrl', '⌘', 'K'], label: 'Open Command Palette & Global Search' },
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
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="shortcut-modal-title" maxWidth="max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 id="shortcut-modal-title" className="text-16 font-semibold text-ink">
              Keyboard Shortcuts
            </h2>
            <p className="text-12 text-ink-3">
              Power-user hotkeys for swift platform navigation
            </p>
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
            return (
              <div key={group.title} className="space-y-2">
                <div className="text-12 font-semibold text-ink-2">{group.title}</div>

                <div className="rounded-field border border-line bg-hover/40 divide-y divide-line overflow-hidden">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="px-3.5 py-2.5 flex items-center justify-between text-12"
                    >
                      <span className="text-ink-2">{item.label}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        {item.keys.map((k) => (
                          <kbd
                            key={k}
                            className="px-2 py-0.5 font-mono text-12 font-semibold text-ink bg-surface border border-line rounded"
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
        <div className="pt-2 border-t border-line flex items-center justify-between text-12 text-ink-3">
          <span>Performa Capstone · WCAG 2.1 AA Compliant</span>
          <span className="font-mono">Press Esc to exit</span>
        </div>
    </Modal>
  );
}
