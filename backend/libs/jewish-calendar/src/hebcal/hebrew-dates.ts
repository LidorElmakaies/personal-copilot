// Subpath, not the package root: see hebcal-calendar.calculator.ts.
import { HDate, months } from '@hebcal/core/dist/esm/index';
import type { CivilDate } from '../models/civil-date';

/** A Hebrew date in hebcal's month numbers: NISAN = 1 … TISHREI = 7 … ADAR (I) = 12, ADAR II = 13. */
export interface HebrewDay {
  year: number;
  month: number;
  day: number;
}

export const ADAR = months.ADAR_I; // Adar in a regular year, Adar I in a leap year
export const ADAR_II = months.ADAR_II;

export function hebrewDayOf(date: CivilDate): HebrewDay {
  // hebcal reads a Date's local Y/M/D fields — correct in any server TZ.
  const hd = new HDate(new Date(date.year, date.month - 1, date.day));
  return { year: hd.getFullYear(), month: hd.getMonth(), day: hd.getDate() };
}

export function daysInHebrewMonth(month: number, year: number): number {
  return HDate.daysInMonth(month, year);
}

export function isHebrewLeapYear(year: number): boolean {
  return HDate.isLeapYear(year);
}
