import { describe, it, expect } from 'vitest';
import { generatePassword } from './password';

describe('generatePassword', () => {
  it('returns 16 characters by default', () => {
    expect(generatePassword()).toHaveLength(16);
  });

  it('always meets the server policy: upper, lower, and a number', () => {
    for (let i = 0; i < 200; i += 1) {
      const pw = generatePassword();
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
    }
  });

  it('avoids visually ambiguous characters', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePassword()).not.toMatch(/[IOlo01]/);
    }
  });

  it('clamps the length to at least 8 characters', () => {
    expect(generatePassword(3)).toHaveLength(8);
  });

  it('produces different passwords each time', () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });
});
