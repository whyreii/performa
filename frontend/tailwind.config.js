function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variableName}) calc(100% * ${opacityValue}), transparent)`;
    }
    return `var(${variableName})`;
  };
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="midnight"], [data-theme="dusk"]'],
  theme: {
    extend: {
      borderColor: {
        DEFAULT: 'var(--line)',
      },
      colors: {
        bg: 'var(--bg)',
        side: 'var(--side)',
        surface: 'var(--surface)',
        ink: {
          DEFAULT: withOpacity('--ink'),
          2: withOpacity('--ink-2'),
          3: withOpacity('--ink-3'),
        },
        line: 'var(--line)',
        hover: 'var(--hover)',
        seg: 'var(--seg)',
        accent: {
          DEFAULT: withOpacity('--accent'),
          foreground: 'var(--on-accent)',
        },
        good: withOpacity('--good'),
        ok: withOpacity('--good'),
        bad: withOpacity('--bad'),
        warn: withOpacity('--warn'),
        off: 'var(--off)',
      },
      borderRadius: {
        ctl: 'var(--r-ctl)',
        field: 'var(--r-field)',
        nav: 'var(--r-nav)',
        float: 'var(--r-float)',
      },
      fontFamily: {
        sans: ['Geist Sans', 'Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
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
    require('tailwindcss-animate'),
  ],
};
