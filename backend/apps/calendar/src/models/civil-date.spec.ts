import { addDays, civilDateIn, weekday } from './civil-date';

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
});
