// Vitest global setup: jest-dom matchers, jsdom environment shims, RTL cleanup.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom does not implement these browser APIs; the provider tree and a few UI
// components call them. Minimal, side-effect-free stubs.

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

if (typeof window.scrollTo !== 'function') {
  window.scrollTo = () => {};
}

afterEach(() => {
  cleanup();
});
