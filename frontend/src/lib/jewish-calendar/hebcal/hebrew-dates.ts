import { HDate, months } from '@hebcal/core';
import type { CivilDate } from '../models/civil-date';

/** A Hebrew date in hebcal's month numbers: NISAN = 1 … TISHREI = 7 … ADAR (I) = 12, ADAR II = 13. */
export interface HebrewDay {
  year: number;
  month: number;
  day: number;
}

export const ADAR = months.ADAR_I; // Adar in a regular year, Adar I in a leap year
export const ADAR_II = months.ADAR_II;

// Cached per civil day: a reminder's next firing walks day by day, and every reminder walks the
// same days. Emptied when it grows past MAX_CACHED (a few years of days).
const cache = new Map<number, HebrewDay>();
const MAX_CACHED = 4000;

/** The same object for the same day — read it, don't change it. */
export function hebrewDayOf(date: CivilDate): HebrewDay {
  const key = date.year * 10000 + date.month * 100 + date.day;
  const hit = cache.get(key);
  if (hit) return hit;
  // hebcal reads a Date's local Y/M/D fields — correct in any device time zone.
  const hd = new HDate(new Date(date.year, date.month - 1, date.day));
  const day = {
    year: hd.getFullYear(),
    month: hd.getMonth(),
    day: hd.getDate(),
  };
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(key, day);
  return day;
}

export function daysInHebrewMonth(month: number, year: number): number {
  return HDate.daysInMonth(month, year);
}

export function isHebrewLeapYear(year: number): boolean {
  return HDate.isLeapYear(year);
}
