import {
  dayMonth,
  duration,
  hebrewDate,
  longDate,
  monthTitle,
  shortDate,
  weekdayMonth,
} from './format';
import { translateIn } from './translate';

const en = (key, vars) => translateIn('en', key, vars);
const he = (key, vars) => translateIn('he', key, vars);

// The canvas's dates (H0): Friday 30 October 2026 — Erev Shabbat, 19 Cheshvan 5787.
describe('date formatters', () => {
  it('a long date', () => {
    expect(longDate(en, '2026-10-30')).toBe('Friday 30 October');
    expect(longDate(he, '2026-10-30')).toBe('יום שישי, 30 באוקטובר');
  });

  it('a short date', () => {
    expect(shortDate(en, '2026-10-31')).toBe('Sat 31 Oct');
    expect(shortDate(he, '2026-10-30')).toBe('שישי, 30 באוק׳');
  });

  it('a day and month', () => {
    expect(dayMonth(en, '2026-10-25')).toBe('Oct 25');
    expect(dayMonth(he, '2026-10-25')).toBe('25 באוק׳');
  });

  it("Home's weekday and month", () => {
    expect(weekdayMonth(en, '2026-10-27')).toBe('Tuesday, October');
    expect(weekdayMonth(he, '2026-10-27')).toBe('יום שלישי, אוקטובר');
  });

  it("a month's title", () => {
    expect(monthTitle(en, { year: 2026, month: 10 })).toBe('October 2026');
    expect(monthTitle(he, { year: 2026, month: 10 })).toBe('אוקטובר 2026');
  });

  it("a day's Hebrew date, in Hebrew letters in both languages", () => {
    const hebrew = { dayHe: 'י״ט', month: { he: 'חשון' }, yearHe: 'תשפ״ז' };
    expect(hebrewDate(en, hebrew)).toBe('י״ט חשון תשפ״ז');
    expect(hebrewDate(he, hebrew)).toBe('י״ט בחשון תשפ״ז');
  });

  it("a Date is read on the phone's clock, a YYYY-MM-DD as the day it names", () => {
    const fridayEvening = new Date(2026, 9, 30, 16, 32);
    expect(shortDate(en, fridayEvening)).toBe('Fri 30 Oct');
    expect(shortDate(en, '2026-01-01')).toBe('Thu 1 Jan');
  });
});

describe('duration', () => {
  it('hours and minutes', () => {
    expect([30, 60, 90, 120, 180].map((m) => duration(en, m))).toEqual([
      '30m',
      '1h',
      '1h 30m',
      '2h',
      '3h',
    ]);
    expect([30, 60, 90, 120, 180].map((m) => duration(he, m))).toEqual([
      '30 דק׳',
      'שעה',
      'שעה ו־30 דק׳',
      'שעתיים',
      '3 שעות',
    ]);
  });
});
