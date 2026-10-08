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
  darkMode: ['class', '[data-theme="graphite"]'],
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
        notice: withOpacity('--notice'),
        off: 'var(--off)',
      },
      borderRadius: {
        ctl: 'var(--r-ctl)',
        field: 'var(--r-field)',
        nav: 'var(--r-nav)',
        float: 'var(--r-float)',
        'float-inner': 'var(--r-float-inner)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'Menlo', 'monospace'],
        // Numeric/data face: IBM Plex Sans (owner decision — no platform system
        // face). Tabular figures are set on `.font-num` in index.css. See --num.
        num: ['IBM Plex Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // Scale B — the only five type sizes (see tokens.css). Mono stays for
      // numbers/dates/IDs; 12px floor uses weight 450–500.
      fontSize: {
        12: ['var(--t-12)', { lineHeight: '1.5' }],
        14: ['var(--t-14)', { lineHeight: '1.5' }],
        16: ['var(--t-16)', { lineHeight: '1.5' }],
        22: ['var(--t-22)', { lineHeight: '1.3' }],
        30: ['var(--t-30)', { lineHeight: '1.15' }],
      },
      boxShadow: {
        side: 'var(--shadow)',
        pop: 'var(--pop)',
      },
      opacity: {
        8: '0.08',
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
