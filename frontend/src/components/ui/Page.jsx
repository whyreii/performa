import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useChrome } from '../../context/ChromeContext';

// Canonical page wrapper. Owns the per-page vertical rhythm (24px) and the page
// transition. It deliberately does NOT define max-width or padding: the
// "gallery wall" lives once in AppShell.jsx (docs/LAYOUT_GRAMMAR.md; enforced by
// backend/tests/guardrails/test_page_wrapper.py).
//
// In the iMac shell the page title renders in the top toolbar and the actions
// portal into the toolbar's action slot — pages keep passing title/actions here
// unchanged. `header={false}` leaves the toolbar empty (pages that render their
// own hero, e.g. the employee record).
//
// `reveal` (default) fades the whole page in on mount as a single composited
// layer (never one layer per section — see index.css). The app's Reduce-motion
// setting and prefers-reduced-motion collapse it to instant.
export default function Page({
  kicker,
  title,
  actions,
  header = true,
  headerClassName = '',
  aboveHeader,
  reveal = true,
  printSheet = false,
  className = '',
  children,
  ...props
}) {
  const { setTitle, actionsEl } = useChrome();

  useEffect(() => {
    setTitle(header ? title || '' : '');
    return () => {
      setTitle('');
    };
  }, [header, title, setTitle]);

  const classes = [
    'space-y-6',
    reveal ? 'page-enter' : '',
    printSheet ? 'print-sheet' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {aboveHeader}
      {/* The visible title lives in the shell toolbar; keep the semantic page
          heading here (visually hidden) so the page still has exactly one h1 —
          for assistive tech and for pages rendered without the shell. */}
      {header && title ? <h1 className="sr-only">{title}</h1> : null}
      {/* Actions render into the toolbar's slot when the shell is present; fall
          back to inline (e.g. pages rendered without the shell) so they're never
          dropped. */}
      {header && actions ? (actionsEl ? createPortal(actions, actionsEl) : actions) : null}
      {children}
    </div>
  );
}
