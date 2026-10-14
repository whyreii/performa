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
        DEFAULT: withOpacity('--line'),
      },
      colors: {
        bg: withOpacity('--bg'),
        side: withOpacity('--side'),
        surface: withOpacity('--surface'),
        ink: {
          DEFAULT: withOpacity('--ink'),
          2: withOpacity('--ink-2'),
          3: withOpacity('--ink-3'),
        },
        line: withOpacity('--line'),
        hover: withOpacity('--hover'),
        seg: withOpacity('--seg'),
        glass: withOpacity('--glass'),
        'glass-line': withOpacity('--glass-line'),
        accent: {
          DEFAULT: withOpacity('--accent'),
          foreground: 'var(--on-accent)',
        },
        good: withOpacity('--good'),
        ok: withOpacity('--good'),
        bad: withOpacity('--bad'),
        warn: withOpacity('--warn'),
        notice: withOpacity('--notice'),
        off: withOpacity('--off'),
      },
      borderRadius: {
        ctl: 'var(--r-ctl)',
        field: 'var(--r-field)',
        nav: 'var(--r-nav)',
        float: 'var(--r-float)',
        'float-inner': 'var(--r-float-inner)',
      },
      width: {
        side: 'var(--side-w)',
        'side-collapsed': 'var(--side-w-collapsed)',
      },
      fontFamily: {
        // One family app-wide (owner decision): Inter for UI and for
        // numbers/dates/scores/IDs. Tabular figures are set on `.font-num` in
        // index.css. See --font / --num in tokens.css.
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        num: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // Five text sizes. See tokens.css / docs/LAYOUT_GRAMMAR.md.
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
        win: 'var(--win-shadow)',
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
