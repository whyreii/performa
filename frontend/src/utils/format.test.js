import { describe, it, expect } from 'vitest';
import { getInitials } from './format';

describe('getInitials', () => {
  it('takes the first letters of the first two words', () => {
    expect(getInitials('Maria Midterm')).toBe('MM');
  });

  it('handles a single word and empty input', () => {
    expect(getInitials('Cher')).toBe('C');
    expect(getInitials('')).toBe('U');
  });
});
