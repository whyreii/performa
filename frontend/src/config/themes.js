// Shared theme palette metadata — the single source for the palette list and the
// swatch colors. The runtime colors live in tokens.css ([data-theme]); the `bg`
// and `accent` hexes here MUST mirror tokens.css (guarded by
// backend/tests/guardrails/test_theme_palette.py).
export const PALETTES = [
  {
    id: 'paper',
    name: 'Paper',
    type: 'Light',
    desc: 'Refined editorial warmth with terracotta rust accents',
    bg: '#f6f3ed',
    accent: '#b94b21',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    type: 'Dark',
    desc: 'Obsidian slate with vibrant electric blue highlights',
    bg: '#090b10',
    accent: '#60a5fa',
  },
  {
    id: 'dusk',
    name: 'Dusk',
    type: 'Dark',
    desc: 'Deep cosmic amethyst with vivid violet tones',
    bg: '#0c0a14',
    accent: '#a78bfa',
  },
  {
    id: 'mist',
    name: 'Mist',
    type: 'Light',
    desc: 'Scandinavian technical slate with cool cyan-azure',
    bg: '#f0f4f8',
    accent: '#0274af',
  },
  {
    id: 'sage',
    name: 'Sage',
    type: 'Light',
    desc: 'Organic herbal spruce with deep emerald accents',
    bg: '#edf2ee',
    accent: '#0f766e',
  },
];

export const PALETTE_IDS = PALETTES.map((p) => p.id);

export const PALETTE_MODES = Object.fromEntries(
  PALETTES.map((p) => [p.id, p.type.toLowerCase()])
);

export const PALETTE_BG = Object.fromEntries(PALETTES.map((p) => [p.id, p.bg]));

export const DEFAULT_LIGHT_PALETTE = 'paper';
export const DEFAULT_DARK_PALETTE = 'midnight';

export function isValidPalette(id) {
  return PALETTE_IDS.includes(id);
}
