import { describe, it, expect, afterEach } from 'vitest';
import { isMac, modifierKey } from './platform';

const original = navigator.platform;
const setPlatform = (value) =>
  Object.defineProperty(navigator, 'platform', { value, configurable: true });

afterEach(() => setPlatform(original));

describe('platform modifier key', () => {
  it('shows ⌘ on macOS', () => {
    setPlatform('MacIntel');
    expect(isMac()).toBe(true);
    expect(modifierKey()).toBe('⌘');
  });

  it('shows Ctrl on Windows/Linux', () => {
    setPlatform('Win32');
    expect(isMac()).toBe(false);
    expect(modifierKey()).toBe('Ctrl');
  });
});
