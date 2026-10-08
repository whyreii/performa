import React, { useEffect, useRef } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions --
   Modal pattern: the backdrop is a decorative overlay (keyboard dismissal is Escape +
   the dialog focus trap), and the role="dialog" panel's keydown IS the focus trap.
   These are the correct native-modal interactions, not static-element misuse. */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog shell: role/aria-modal, Escape, focus trap, autofocus, and
// focus return to the opener on close. Replaces the 7 hand-rolled modal shells
// (see docs/SLOP_AUDIT.md, Phase A).
export default function Modal({
  isOpen,
  onClose,
  labelledBy,
  label,
  maxWidth = 'max-w-md',
  padded = true,
  panelClassName = '',
  children,
}) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    const first = panel
      ? panel.querySelector('input:not([type="hidden"]), textarea, select') ||
        panel.querySelector(FOCUSABLE)
      : null;
    (first || panel)?.focus();
    return () => {
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} bg-surface border border-line rounded-float shadow-pop overscroll-contain${padded ? ' p-6 space-y-4' : ''}${panelClassName ? ` ${panelClassName}` : ''} outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
