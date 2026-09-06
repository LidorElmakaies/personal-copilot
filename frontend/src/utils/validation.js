const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(email.trim());
}

export const PASSWORD_REQUIREMENTS_HINT = 'At least 8 characters.';
