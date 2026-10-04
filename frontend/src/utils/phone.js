import {
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from 'libphonenumber-js';

// Countries the phone field offers. Adding one is just a new entry — libphonenumber-js already
// knows every country's numbering plan.
export const PHONE_COUNTRIES = [
  { code: 'IL', name: 'Israel', flag: '🇮🇱', dialCode: '+972' },
];

export const DEFAULT_PHONE_COUNTRY = 'IL';

export function onlyDigits(text) {
  return text.replace(/\D/g, '');
}

// null when the field is empty or valid. Length is checked first for a clearer message, then the
// number itself (e.g. Israel: 05X mobile, 02/03/04/08/09 landline, 07X).
export function phoneError(country, local) {
  if (local.length === 0) return null;
  const lengthProblem = validatePhoneNumberLength(local, country);
  if (lengthProblem === 'TOO_SHORT') return 'Phone number is too short';
  if (lengthProblem === 'TOO_LONG') return 'Phone number is too long';
  if (!parsePhoneNumberFromString(local, country)?.isValid()) {
    return 'Not a valid phone number';
  }
  return null;
}

// The local number as the user typed it (with or without the leading 0) → E.164 for the API.
export function toE164(country, local) {
  if (local.length === 0) return null;
  return parsePhoneNumberFromString(local, country)?.number ?? null;
}

// A stored E.164 number → the country + local digits the form edits ('+972501234567' → '0501234567').
export function fromE164(e164) {
  const parsed = e164 ? parsePhoneNumberFromString(e164) : undefined;
  const known = PHONE_COUNTRIES.some((c) => c.code === parsed?.country);
  if (!parsed || !known) {
    return { country: DEFAULT_PHONE_COUNTRY, local: '' };
  }
  return {
    country: parsed.country,
    local: onlyDigits(parsed.formatNational()),
  };
}
