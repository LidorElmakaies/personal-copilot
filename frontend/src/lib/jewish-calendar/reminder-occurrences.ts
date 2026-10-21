import {
  ADAR,
  ADAR_II,
  daysInHebrewMonth,
  hebrewDayOf,
  isHebrewLeapYear,
} from './hebcal/hebrew-dates';
import {
  addDays,
  civilDateIn,
  daysInMonth,
  instantAt,
  isoDate,
  type CivilDate,
} from './models/civil-date';
import type { ReminderRule } from './models/reminder-rule';

/** Implemented by ReminderOccurrences. In-process, pure and synchronous — no I/O. */
export interface IReminderOccurrences {
  /** Whether the reminder falls on `date`. */
  fallsOn(rule: ReminderRule, date: CivilDate): boolean;
  /** Every day from `from` to `to` (both included) the reminder falls on. */
  datesBetween(rule: ReminderRule, from: CivilDate, to: CivilDate): CivilDate[];
  /** The first time it fires strictly after `after`, its wall-clock time in `timeZone`; null if never. */
  nextAfter(rule: ReminderRule, after: Date, timeZone: string): Date | null;
}

// Covers a yearly reminder with several years in a row skipped.
const MAX_SEARCH_DAYS = 10 * 386;

// A date a month or year doesn't have (a Hebrew 30th in a 29-day month, the 31st, 29 Feb) falls on
// that month's last day. A Hebrew yearly one in Adar made in a regular year is in Adar II in a leap
// year; one in Adar I or II of a leap year is in Adar in a regular year. See README.md.
export class ReminderOccurrences implements IReminderOccurrences {
  fallsOn(rule: ReminderRule, date: CivilDate): boolean {
    const day = isoDate(date);
    if (day < isoDate(rule.start)) return false;
    if (rule.skipped?.some((s) => isoDate(s) === day)) return false;
    switch (rule.repeat) {
      case 'once':
        return day === isoDate(rule.start);
      case 'daily':
        return true;
      case 'monthly':
        return rule.calendar === 'hebrew'
          ? hebrewMonthly(rule.start, date)
          : gregorianMonthly(rule.start, date);
      case 'yearly':
        return rule.calendar === 'hebrew'
          ? hebrewYearly(rule.start, date)
          : date.month === rule.start.month &&
              gregorianMonthly(rule.start, date);
    }
  }

  datesBetween(
    rule: ReminderRule,
    from: CivilDate,
    to: CivilDate,
  ): CivilDate[] {
    const out: CivilDate[] = [];
    const last = isoDate(to);
    for (let d = from; isoDate(d) <= last; d = addDays(d, 1)) {
      if (this.fallsOn(rule, d)) out.push(d);
    }
    return out;
  }

  nextAfter(rule: ReminderRule, after: Date, timeZone: string): Date | null {
    if (rule.repeat === 'once') {
      if (!this.fallsOn(rule, rule.start)) return null; // its one day skipped
      const at = instantAt(timeZone, rule.start, rule.hour, rule.minute);
      return at > after ? at : null;
    }
    const today = civilDateIn(timeZone, after);
    let day = isoDate(rule.start) > isoDate(today) ? rule.start : today;
    for (let i = 0; i < MAX_SEARCH_DAYS; i++, day = addDays(day, 1)) {
      if (!this.fallsOn(rule, day)) continue;
      const at = instantAt(timeZone, day, rule.hour, rule.minute);
      if (at > after) return at;
    }
    return null;
  }
}

function gregorianMonthly(start: CivilDate, date: CivilDate): boolean {
  return date.day === Math.min(start.day, daysInMonth(date.year, date.month));
}

function hebrewMonthly(start: CivilDate, date: CivilDate): boolean {
  const s = hebrewDayOf(start);
  const d = hebrewDayOf(date);
  return d.day === Math.min(s.day, daysInHebrewMonth(d.month, d.year));
}

function hebrewYearly(start: CivilDate, date: CivilDate): boolean {
  const s = hebrewDayOf(start);
  const d = hebrewDayOf(date);
  const leap = isHebrewLeapYear(d.year);
  let month = s.month;
  if (month === ADAR && !isHebrewLeapYear(s.year) && leap) month = ADAR_II;
  else if (month === ADAR_II && !leap) month = ADAR;
  return (
    d.month === month &&
    d.day === Math.min(s.day, daysInHebrewMonth(month, d.year))
  );
}
