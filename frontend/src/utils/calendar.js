import { pad2 } from './time';

// The device's local date, YYYY-MM-DD — the form GET /calendar/month's `date` uses.
export function localIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// { year, month } moved by `by` months, across year ends.
export function shiftMonth({ year, month }, by) {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// "September 2026".
export const monthTitle = ({ year, month }) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });

// "אלול – תשרי תשפ״ז": the Hebrew months a Gregorian month spans, and the year it ends in.
export function hebrewTitle(days) {
  const months = [...new Set(days.map((d) => d.hebrew.month.he))];
  return `${months.join(' – ')} ${days.at(-1).hebrew.yearHe}`;
}
