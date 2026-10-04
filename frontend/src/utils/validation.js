const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(email.trim());
}

export const PASSWORD_REQUIREMENTS_HINT = 'At least 8 characters.';

// Same rules as the Users Service (NAME_MAX_LENGTH, NAME_PATTERN in @app/kafka-contracts).
export const NAME_MAX_LENGTH = 100;

// English (A-Z, a-z) and Hebrew (U+05D0–U+05EA, incl. final forms) letters only — no niqqud,
// digits or punctuation. Anything else is dropped as it's typed; spaces collapse to one.
const NOT_NAME_CHAR = /[^A-Za-zא-ת ]/g;

export function sanitizeName(text) {
  return text
    .replace(NOT_NAME_CHAR, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /, '');
}
