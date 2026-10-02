/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="midnight"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        side: 'var(--side)',
        surface: 'var(--surface)',
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        line: 'var(--line)',
        hover: 'var(--hover)',
        seg: 'var(--seg)',
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--on-accent)',
        },
        good: 'var(--good)',
        bad: 'var(--bad)',
        warn: 'var(--warn)',
        off: 'var(--off)',
      },
      borderRadius: {
        ctl: 'var(--r-ctl)',
        field: 'var(--r-field)',
        nav: 'var(--r-nav)',
        float: 'var(--r-float)',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        side: 'var(--shadow)',
        pop: 'var(--pop)',
      },
      transitionTimingFunction: {
        performa: 'cubic-bezier(0.2, 0.6, 0.2, 1)',
      },
      transitionDuration: {
        performa: '160ms',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    require('@tailwindcss/container-queries'),
  ],
};
