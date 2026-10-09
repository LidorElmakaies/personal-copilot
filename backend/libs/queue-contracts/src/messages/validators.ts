export const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;

export const isIsoDate = (v: unknown): v is string =>
  isNonEmptyString(v) && !Number.isNaN(Date.parse(v));
