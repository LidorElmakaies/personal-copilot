const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(email.trim());
}

export const PASSWORD_REQUIREMENTS_HINT = 'At least 8 characters.';

// Same limit as the Users Service (NAME_MAX_LENGTH in @app/kafka-contracts).
export const NAME_MAX_LENGTH = 100;

// Letters (Latin incl. accented, Cyrillic, Hebrew, Arabic), spaces, hyphens and apostrophes —
// anything else is dropped as it's typed. Built from code points so the source stays readable.
const NAME_LETTER_RANGES = [
  [0xc0, 0x24f], // Latin with accents
  [0x400, 0x4ff], // Cyrillic
  [0x590, 0x5ff], // Hebrew
  [0x600, 0x6ff], // Arabic
];
const NOT_NAME_CHAR = new RegExp(
  `[^A-Za-z '\\-${NAME_LETTER_RANGES.map(
    ([from, to]) => `\\u${hex(from)}-\\u${hex(to)}`,
  ).join('')}]`,
  'g',
);

function hex(codePoint) {
  return codePoint.toString(16).padStart(4, '0');
}

export function sanitizeName(text) {
  return text.replace(NOT_NAME_CHAR, '');
}
