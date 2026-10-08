import { useEffect } from 'react';
import { BRAND } from '../config/brand';

// Sets the document title per route (WCAG 2.4.2 — Page Titled).
// Usage: useDocumentTitle('Dashboard') → "Dashboard · Performa"
const BASE_TITLE = BRAND.name;

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : BASE_TITLE;
  }, [title]);
}

export default useDocumentTitle;
