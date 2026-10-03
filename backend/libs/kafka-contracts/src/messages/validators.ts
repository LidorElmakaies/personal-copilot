export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;

export const isIsoDate = (v: unknown): v is string =>
  isNonEmptyString(v) && !Number.isNaN(Date.parse(v));

/** E.164: `+`, country code, up to 15 digits in all. */
export const PHONE_E164 = /^\+[1-9]\d{6,14}$/;

export const isPhone = (v: unknown): v is string =>
  typeof v === 'string' && PHONE_E164.test(v);

export const NAME_MAX_LENGTH = 100;

export const isName = (v: unknown): v is string =>
  isNonEmptyString(v) && v.length <= NAME_MAX_LENGTH;
