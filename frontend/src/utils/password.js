// Password generation for admin credential provisioning.
//
// Client-side only: the generated value is submitted through the normal
// create-user / reset-password endpoints, so no backend change is needed.
// Guarantees at least one upper, lower, digit, and symbol, and avoids visually
// ambiguous characters (I, O, l, o, 0, 1).

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*()-_=+';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function randomInt(max) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

function pick(charset) {
  return charset[randomInt(charset.length)];
}

/**
 * Return a strong random password. Length is clamped to the API bounds
 * (`schemas.py`: min 8, max 128); the default is 16.
 */
export function generatePassword(length = 16) {
  const size = Math.min(128, Math.max(8, Math.trunc(length) || 16));
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) chars.push(pick(ALL));
  // Fisher-Yates so the guaranteed classes are not stuck at fixed positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
