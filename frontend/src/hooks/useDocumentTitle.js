import { useEffect } from 'react';

// Sets the document title per route (WCAG 2.4.2 — Page Titled).
// Usage: useDocumentTitle('Dashboard') → "Dashboard · Performa"
const BASE_TITLE = 'Performa · Probationary Performance Management';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Performa` : BASE_TITLE;
  }, [title]);
}

export default useDocumentTitle;
