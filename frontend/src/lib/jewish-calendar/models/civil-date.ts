// A calendar date with no time or zone attached — "Friday 2 Oct" as the user sees it locally.
export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number;
}

// Building an Intl.DateTimeFormat is slow (on Hermes especially) and these run per day per
// reminder: one of each per time zone, made on first use.
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

function cached(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let format = cache.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
    cache.set(timeZone, format);
  }
  return format;
}

export function civilDateIn(timeZone: string, instant: Date): CivilDate {
  const parts = cached(dateFormats, timeZone, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: CivilDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 'YYYY-MM-DD' — also orders correctly as a string. */
export function isoDate(date: CivilDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

/**
 * The instant the clock in `timeZone` shows `hour:minute` on `date`. A time skipped when the clocks
 * go forward lands that much later (02:30 → 03:30); one that happens twice when they go back is the
 * second.
 */
export function instantAt(
  timeZone: string,
  date: CivilDate,
  hour: number,
  minute: number,
): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const first = wall - offsetAt(timeZone, wall);
  // The offset at the first guess decides; it differs only across a change of the clocks.
  return new Date(wall - offsetAt(timeZone, first));
}

// How far `timeZone`'s clock is ahead of UTC at `instant`, in ms.
function offsetAt(timeZone: string, instant: number): number {
  const parts = cached(dateTimeFormats, timeZone, {
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(instant));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  const local = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
  );
  return local - (instant - (instant % 60000));
}
