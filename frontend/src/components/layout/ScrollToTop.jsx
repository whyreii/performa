import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// On route change: reset the scroll (the window's content pane on desktop, the
// document on mobile) and move focus to the main region so assistive tech
// announces the new page (WCAG 2.4.3 — Focus Order / SPA route change).
// <main id="main" tabIndex={-1}> lives in AppShell.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;

    const el = document.scrollingElement || document.documentElement;
    if (el) el.scrollTop = 0;

    if (main) main.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
