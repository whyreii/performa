import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Test-only config (kept separate from vite.config.js so the production build
// is untouched). jsdom + Testing Library; CSS is not processed.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**', 'src/types/**'],
      // Ratchet baseline (raised as page/E2E tests land). Not a target.
      thresholds: { statements: 71, branches: 68, functions: 39, lines: 71 },
    },
  },
});
