import { describe, it, expect } from 'vitest';
import {
  PALETTES,
  PALETTE_MODES,
  isValidPalette,
  DEFAULT_LIGHT_PALETTE,
  DEFAULT_DARK_PALETTE,
} from './themes';

describe('theme palette metadata', () => {
  it('defines two curated palettes with mirrored ids/modes', () => {
    expect(PALETTES).toHaveLength(2);
    expect(PALETTE_MODES.paper).toBe('light');
    expect(PALETTE_MODES.graphite).toBe('dark');
    expect(DEFAULT_LIGHT_PALETTE).toBe('paper');
    expect(DEFAULT_DARK_PALETTE).toBe('graphite');
  });

  it('validates palette ids', () => {
    expect(isValidPalette('paper')).toBe(true);
    expect(isValidPalette('nope')).toBe(false);
  });
});
