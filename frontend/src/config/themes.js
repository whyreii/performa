// Shared theme palette metadata — the single source for the palette list and the
// swatch colors. The runtime colors live in tokens.css ([data-theme]); the `bg`
// and `accent` hexes here MUST mirror tokens.css (guarded by
// backend/tests/guardrails/test_theme_palette.py).
//
// Two curated themes: paper (light) + graphite (dark, black/white). The
// Light/Dark/System control (ThemeContext) picks the mode; these are the two
// palettes it maps to.
export const PALETTES = [
  {
    id: 'paper',
    name: 'Paper',
    type: 'Light',
    desc: 'Warm editorial ivory with a terracotta accent',
    bg: '#f6f3ed',
    accent: '#b94b21',
  },
  {
    id: 'graphite',
    name: 'Mono',
    type: 'Dark',
    desc: 'Pure black & white with a single white accent',
    bg: '#000000',
    accent: '#ffffff',
  },
];

export const PALETTE_IDS = PALETTES.map((p) => p.id);

export const PALETTE_MODES = Object.fromEntries(
  PALETTES.map((p) => [p.id, p.type.toLowerCase()])
);

export const PALETTE_BG = Object.fromEntries(PALETTES.map((p) => [p.id, p.bg]));

export const DEFAULT_LIGHT_PALETTE = 'paper';
export const DEFAULT_DARK_PALETTE = 'graphite';

export function isValidPalette(id) {
  return PALETTE_IDS.includes(id);
}
