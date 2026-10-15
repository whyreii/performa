// Client-side mirror of backend/passwords.py: a cryptographically random password
// with no visually ambiguous characters, one of each class, and always enough to
// satisfy the server policy (8+ characters with an uppercase letter, a lowercase
// letter and a number).
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*()-_=+';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

// Uniform index in [0, n) without modulo bias.
const randomIndex = (n) => {
  const limit = 0x100000000 - (0x100000000 % n);
  const buf = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % n;
};

const pick = (chars) => chars[randomIndex(chars.length)];

export function generatePassword(length = 16) {
  const size = Math.max(8, Math.min(128, length));
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
