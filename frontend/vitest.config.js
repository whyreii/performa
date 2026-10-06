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
  },
});
