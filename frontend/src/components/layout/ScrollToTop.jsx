import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Resets the window scroll on route change. The app scrolls the document
// (document.scrollingElement), not <main> — see ARCHITECTURE/measurement notes.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const el = document.scrollingElement || document.documentElement;
    if (el) el.scrollTop = 0;
  }, [pathname]);

  return null;
}
