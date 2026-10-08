import { describe, it, expect } from 'vitest';
import { generatePassword } from './password';

describe('generatePassword', () => {
  it('returns 16 characters by default', () => {
    expect(generatePassword()).toHaveLength(16);
  });

  it('clamps length to the API bounds (8–128)', () => {
    expect(generatePassword(4)).toHaveLength(8);
    expect(generatePassword(200)).toHaveLength(128);
    expect(generatePassword(8)).toHaveLength(8);
  });

  it('always includes an uppercase, lowercase, digit, and symbol', () => {
    for (let i = 0; i < 50; i += 1) {
      const pwd = generatePassword();
      expect(pwd).toMatch(/[A-Z]/);
      expect(pwd).toMatch(/[a-z]/);
      expect(pwd).toMatch(/[0-9]/);
      expect(pwd).toMatch(/[!@#$%^&*()\-_=+]/);
    }
  });

  it('avoids visually ambiguous characters', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePassword()).not.toMatch(/[IOlo01]/);
    }
  });
});
