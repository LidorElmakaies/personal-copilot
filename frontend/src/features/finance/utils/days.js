import { weekdayOf } from '../../../shared/utils/date';

// The month a YYYY-MM-DD date is in, `{ year, month }`.
export const monthOf = (date) => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
});

// A month's days (YYYY-MM-DD) as Sunday-first weeks of 7, null outside the month.
export function monthWeeks({ year, month }) {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const days = Array.from(
    { length: count },
    (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`,
  );
  const cells = [...Array(weekdayOf(days[0])).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
}
