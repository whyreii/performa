import { useEffect } from 'react';

// Calls `onEscape` when the user presses Escape while `active` is true.
export function useEscapeKey(onEscape, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape, active]);
}

export default useEscapeKey;
