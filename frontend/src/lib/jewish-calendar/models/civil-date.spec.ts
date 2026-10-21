import {
  addDays,
  civilDateIn,
  daysInMonth,
  instantAt,
  isoDate,
  weekday,
} from './civil-date';

describe('civil-date', () => {
  it('reads the local date in the given time zone, not UTC', () => {
    const instant = new Date('2026-10-02T22:30:00Z'); // Sat 01:30 in Israel, Fri 18:30 in New York
    expect(civilDateIn('Asia/Jerusalem', instant)).toEqual({
      year: 2026,
      month: 10,
      day: 3,
    });
    expect(civilDateIn('America/New_York', instant)).toEqual({
      year: 2026,
      month: 10,
      day: 2,
    });
  });

  it('adds days across month and year ends', () => {
    expect(addDays({ year: 2026, month: 9, day: 30 }, 2)).toEqual({
      year: 2026,
      month: 10,
      day: 2,
    });
    expect(addDays({ year: 2027, month: 1, day: 1 }, -1)).toEqual({
      year: 2026,
      month: 12,
      day: 31,
    });
  });

  it('gives the weekday with Sunday = 0', () => {
    expect(weekday({ year: 2026, month: 9, day: 27 })).toBe(0);
    expect(weekday({ year: 2026, month: 10, day: 2 })).toBe(5);
  });

  it('counts the days in a month, leap years included', () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('writes a date as YYYY-MM-DD', () => {
    expect(isoDate({ year: 2026, month: 3, day: 9 })).toBe('2026-03-09');
  });

  describe('instantAt', () => {
    const day = (year: number, month: number, d: number) => ({
      year,
      month,
      day: d,
    });

    it('turns a wall-clock time into an instant in that zone', () => {
      expect(instantAt('Asia/Jerusalem', day(2026, 10, 21), 19, 30)).toEqual(
        new Date('2026-10-21T16:30:00Z'), // summer time, +3
      );
      expect(instantAt('Asia/Jerusalem', day(2026, 12, 1), 19, 30)).toEqual(
        new Date('2026-12-01T17:30:00Z'), // winter time, +2
      );
      expect(instantAt('America/New_York', day(2026, 12, 1), 8, 0)).toEqual(
        new Date('2026-12-01T13:00:00Z'),
      );
    });

    it('a time skipped when the clocks go forward lands that much later', () => {
      // Israel: 02:00 → 03:00 on Friday 26 March 2027; 02:30 doesn't exist.
      expect(instantAt('Asia/Jerusalem', day(2027, 3, 26), 2, 30)).toEqual(
        new Date('2027-03-26T00:30:00Z'), // 03:30 summer time
      );
    });

    it('a time that happens twice when the clocks go back is the second', () => {
      // Israel: 02:00 → 01:00 on Sunday 25 October 2026; 01:30 happens twice.
      expect(instantAt('Asia/Jerusalem', day(2026, 10, 25), 1, 30)).toEqual(
        new Date('2026-10-24T23:30:00Z'), // 01:30 winter time
      );
    });
  });
});
