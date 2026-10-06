import React, { useEffect, useRef, useState } from 'react';

// Count Up (adapted from React Bits). Animates a number from 0 up to `value`
// on mount and whenever the value changes. The value itself always comes from
// the API/DB — only the interpolation is generated. Honours
// prefers-reduced-motion by showing the final value immediately.
function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  const osPrefers =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const appPrefers =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-reduce-motion') === 'true';
  return osPrefers || appPrefers;
}

export default function CountUp({
  value,
  decimals = 0,
  duration = 650,
  className = '',
  ...props
}) {
  const target = Number(value);
  const finite = Number.isFinite(target);
  const finalText = finite ? target.toFixed(decimals) : String(value ?? '');
  const [text, setText] = useState(() =>
    finite && !prefersReducedMotion() ? (0).toFixed(decimals) : finalText
  );
  const rafRef = useRef(0);

  useEffect(() => {
    if (!finite || prefersReducedMotion()) {
      setText(finalText);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        setText((target * eased).toFixed(decimals));
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setText(finalText);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, finite, decimals, duration, finalText]);

  return (
    <span className={className} {...props}>
      {text}
    </span>
  );
}
