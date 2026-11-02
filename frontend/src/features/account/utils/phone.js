import {
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from 'libphonenumber-js';

// Countries the phone field offers, each named by the dictionary's `country.<code>`. Adding one is
// just a new entry (and its name) — libphonenumber-js already knows every country's numbering plan.
export const PHONE_COUNTRIES = [{ code: 'IL', flag: '🇮🇱', dialCode: '+972' }];

export const DEFAULT_PHONE_COUNTRY = 'IL';

export function onlyDigits(text) {
  return text.replace(/\D/g, '');
}

// null when the field is empty or valid, else the problem's dictionary key. Length is checked first
// for a clearer message, then the number itself (e.g. Israel: 05X mobile, 02/03/04/08/09
// landline, 07X).
export function phoneError(country, local) {
  if (local.length === 0) return null;
  const lengthProblem = validatePhoneNumberLength(local, country);
  if (lengthProblem === 'TOO_SHORT') return 'phone.tooShort';
  if (lengthProblem === 'TOO_LONG') return 'phone.tooLong';
  if (!parsePhoneNumberFromString(local, country)?.isValid()) {
    return 'phone.invalid';
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
