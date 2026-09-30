import crypto from 'node:crypto';

// Digits and uppercase letters without the look-alikes 0, O, 1, I and L.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 20;
// Largest multiple of the alphabet size that fits in a byte. Bytes at or above it are
// dropped so every character is equally likely (plain byte % 31 would favour some).
const BYTE_LIMIT = 256 - (256 % ALPHABET.length);
const RAW_PATTERN = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

export function generateCaseCode() {
  let code = '';

  while (code.length < LENGTH) {
    for (const byte of crypto.randomBytes(LENGTH)) {
      if (byte < BYTE_LIMIT && code.length < LENGTH) code += ALPHABET[byte % ALPHABET.length];
    }
  }

  return code;
}

export function formatCaseCode(raw: string) {
  return `WD-${raw.match(/.{5}/g)!.join('-')}`;
}

export function normalizeCaseCode(input: string) {
  const raw = input.trim().toUpperCase().replace(/^WD-/, '').replaceAll('-', '');
  return RAW_PATTERN.test(raw) ? raw : null;
}

// A fast unsalted hash is enough here: codes are random with about 99 bits of entropy,
// so unlike passwords they cannot be guessed or brute-forced from the hash.
export function hashCaseCode(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
