import { civilDate, nextDates, ruleOf } from './occurrences';

// The add sheet's "Next": in Israel's time whatever the phone's. A zone far from Israel's on
// purpose, so a date worked out in the phone's local time shows up as a wrong day.
process.env.TZ = 'America/Los_Angeles';

const daily = (hour, minute = 0, start = '2026-10-01') => ({
  hour,
  minute,
  repeat: 'daily',
  calendar: 'gregorian',
  start,
});

describe('occurrences', () => {
  it('civilDate and ruleOf turn a definition into the lib rule', () => {
    expect(civilDate('2026-10-21')).toEqual({ year: 2026, month: 10, day: 21 });
    const reminder = { ...daily(8), skipped: ['2026-10-05'] };
    expect(ruleOf(reminder)).toEqual({
      start: { year: 2026, month: 10, day: 1 },
      hour: 8,
      minute: 0,
      repeat: 'daily',
      calendar: 'gregorian',
      skipped: [{ year: 2026, month: 10, day: 5 }],
    });
    expect(ruleOf(daily(8)).skipped).toEqual([]); // no skipped field at all
  });

  describe('nextDates', () => {
    it('gives the next 3 days, in order', () => {
      const now = new Date('2026-10-21T03:00:00Z'); // 06:00 in Israel
      expect(nextDates(daily(8), now)).toEqual([
        '2026-10-21',
        '2026-10-22',
        '2026-10-23',
      ]);
      expect(
        nextDates({ ...daily(9), repeat: 'monthly', start: '2026-01-31' }, now),
      ).toEqual(['2026-10-31', '2026-11-30', '2026-12-31']);
    });

    it('takes a count', () => {
      const now = new Date('2026-10-21T03:00:00Z');
      expect(nextDates(daily(8), now, 1)).toEqual(['2026-10-21']);
    });

    it('a once-reminder: its day while ahead, [] once its time has passed', () => {
      const once = { ...daily(8), repeat: 'once', start: '2026-10-21' };
      expect(nextDates(once, new Date('2026-10-21T04:59:00Z'))).toEqual([
        '2026-10-21',
      ]);
      expect(nextDates(once, new Date('2026-10-21T05:00:00Z'))).toEqual([]); // 08:00 Israel
      expect(nextDates(once, new Date('2026-11-01T00:00:00Z'))).toEqual([]);
    });

    it("a daily one whose time today has passed in Israel starts tomorrow — Israel's day, not UTC's", () => {
      // 01:30 on 21 Oct in Israel, still 20 Oct in UTC (and the 20th, evening, in Los Angeles)
      const now = new Date('2026-10-20T22:30:00Z');
      expect(nextDates(daily(1), now)).toEqual([
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
      ]);
      expect(nextDates(daily(2), now)).toEqual([
        '2026-10-21',
        '2026-10-22',
        '2026-10-23',
      ]);
    });

    it('a daily one not started yet begins on its start', () => {
      const now = new Date('2026-10-21T03:00:00Z');
      expect(nextDates(daily(8, 0, '2026-12-30'), now)).toEqual([
        '2026-12-30',
        '2026-12-31',
        '2027-01-01',
      ]);
    });

    // the clock changes themselves are the lib's (civil-date, reminder-occurrences specs); this
    // one is nextDates' own loop: 01:30 happens twice on 25 Oct 2026, and is that day once
    it('lists a day the time happens twice on (the clocks going back) once', () => {
      const now = new Date('2026-10-24T12:00:00Z');
      expect(nextDates(daily(1, 30, '2026-10-24'), now)).toEqual([
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
      ]);
    });
  });
});
