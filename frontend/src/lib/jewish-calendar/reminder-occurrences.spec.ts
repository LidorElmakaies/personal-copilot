import { isoDate, type CivilDate } from './models/civil-date';
import type { ReminderRule } from './models/reminder-rule';
import { ReminderOccurrences } from './reminder-occurrences';

// Over the real @hebcal/core: the Hebrew dates below are hebcal's.
const occurrences = new ReminderOccurrences();
const ISRAEL = 'Asia/Jerusalem';
const NEW_YORK = 'America/New_York';

const date = (s: string): CivilDate => {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
};
const rule = (
  start: string,
  repeat: ReminderRule['repeat'],
  calendar: ReminderRule['calendar'] = 'gregorian',
  extra: Partial<ReminderRule> = {},
): ReminderRule => ({
  start: date(start),
  hour: 9,
  minute: 0,
  repeat,
  calendar,
  ...extra,
});
const between = (r: ReminderRule, from: string, to: string) =>
  occurrences.datesBetween(r, date(from), date(to)).map(isoDate);
// The days it fires on, one after another from `after`, at most `n`.
function nextDays(r: ReminderRule, after: string, n: number, tz = ISRAEL) {
  const out: string[] = [];
  let at: Date | null = new Date(after);
  while (out.length < n && (at = occurrences.nextAfter(r, at, tz))) {
    out.push(
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at), // YYYY-MM-DD
    );
  }
  return out;
}

describe('ReminderOccurrences', () => {
  describe('once', () => {
    const r = rule('2026-10-21', 'once', 'gregorian', { hour: 19, minute: 30 });

    it('falls only on its day', () => {
      expect(between(r, '2026-10-01', '2026-12-31')).toEqual(['2026-10-21']);
    });

    it('fires once at its local time, and never again', () => {
      expect(
        occurrences.nextAfter(r, new Date('2026-10-01T00:00:00Z'), ISRAEL),
      ).toEqual(
        new Date('2026-10-21T16:30:00Z'), // 19:30 Israel summer time (+3)
      );
      expect(
        occurrences.nextAfter(r, new Date('2026-10-21T16:30:00Z'), ISRAEL),
      ).toBeNull();
    });

    it('never fires when its one day is skipped', () => {
      const skipped = { ...r, skipped: [date('2026-10-21')] };
      expect(
        occurrences.nextAfter(
          skipped,
          new Date('2026-10-01T00:00:00Z'),
          ISRAEL,
        ),
      ).toBeNull();
    });
  });

  describe('daily', () => {
    const r = rule('2026-10-20', 'daily');

    it('falls on every day from its start, not before', () => {
      expect(between(r, '2026-10-18', '2026-10-23')).toEqual([
        '2026-10-20',
        '2026-10-21',
        '2026-10-22',
        '2026-10-23',
      ]);
    });

    it('leaves out a skipped day', () => {
      const skipped = { ...r, skipped: [date('2026-10-21')] };
      expect(between(skipped, '2026-10-20', '2026-10-23')).toEqual([
        '2026-10-20',
        '2026-10-22',
        '2026-10-23',
      ]);
      expect(nextDays(skipped, '2026-10-20T07:00:00Z', 2)).toEqual([
        '2026-10-22',
        '2026-10-23',
      ]);
    });

    it("today if its time hasn't passed yet, otherwise tomorrow", () => {
      // 09:00 Israel = 06:00Z in October (summer time).
      expect(
        occurrences.nextAfter(r, new Date('2026-10-22T05:59:00Z'), ISRAEL),
      ).toEqual(new Date('2026-10-22T06:00:00Z'));
      expect(
        occurrences.nextAfter(r, new Date('2026-10-22T06:00:00Z'), ISRAEL),
      ).toEqual(new Date('2026-10-23T06:00:00Z'));
    });
  });

  describe('monthly, Gregorian', () => {
    it('falls on the same day of every month', () => {
      expect(
        between(rule('2026-10-15', 'monthly'), '2026-10-01', '2027-01-31'),
      ).toEqual(['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15']);
    });

    it('a 31st falls on the last day of shorter months', () => {
      expect(
        between(rule('2027-01-31', 'monthly'), '2027-01-01', '2027-05-31'),
      ).toEqual([
        '2027-01-31',
        '2027-02-28',
        '2027-03-31',
        '2027-04-30',
        '2027-05-31',
      ]);
      expect(
        between(rule('2027-01-31', 'monthly'), '2028-02-01', '2028-02-29'),
      ).toEqual(['2028-02-29']);
    });
  });

  describe('yearly, Gregorian', () => {
    it('falls on the same date every year', () => {
      expect(
        nextDays(rule('2026-10-29', 'yearly'), '2026-10-01T00:00:00Z', 3),
      ).toEqual(['2026-10-29', '2027-10-29', '2028-10-29']);
    });

    it('29 February falls on 28 February in other years', () => {
      expect(
        nextDays(rule('2028-02-29', 'yearly'), '2028-01-01T00:00:00Z', 5),
      ).toEqual([
        '2028-02-29',
        '2029-02-28',
        '2030-02-28',
        '2031-02-28',
        '2032-02-29',
      ]);
    });
  });

  describe('monthly, Hebrew', () => {
    it('a 30th falls on the 29th of a 29-day month', () => {
      // 30 Tishrei 5787; Cheshvan and Kislev 5787 have 30 days, Tevet 29.
      expect(
        nextDays(
          rule('2026-10-11', 'monthly', 'hebrew'),
          '2026-10-01T00:00:00Z',
          4,
        ),
      ).toEqual([
        '2026-10-11', // 30 Tishrei
        '2026-11-10', // 30 Cheshvan
        '2026-12-10', // 30 Kislev
        '2027-01-08', // 29 Tevet
      ]);
    });
  });

  describe('yearly, Hebrew', () => {
    it('falls on the same Hebrew date, moving around the Gregorian year', () => {
      // 15 Cheshvan 5785.
      expect(
        nextDays(
          rule('2024-11-16', 'yearly', 'hebrew'),
          '2026-01-01T00:00:00Z',
          2,
        ),
      ).toEqual([
        '2026-10-26', // 15 Cheshvan 5787
        '2027-11-15', // 15 Cheshvan 5788
      ]);
    });

    it('30 Cheshvan falls on 29 Cheshvan in years Cheshvan has 29 days', () => {
      expect(
        nextDays(
          rule('2026-11-10', 'yearly', 'hebrew'),
          '2026-01-01T00:00:00Z',
          3,
        ),
      ).toEqual([
        '2026-11-10', // 30 Cheshvan 5787
        '2027-11-30', // 30 Cheshvan 5788
        '2028-11-18', // 29 Cheshvan 5789
      ]);
    });

    it('Adar, made in a regular year, is Adar II in a leap year', () => {
      // 14 Adar 5785 (Purim); 5787 is a leap year.
      const r = rule('2025-03-14', 'yearly', 'hebrew');
      expect(between(r, '2027-01-01', '2027-12-31')).toEqual(['2027-03-23']); // 14 Adar II, not 21 Feb
    });

    it('Adar II is Adar in a regular year', () => {
      // 7 Adar II 5787 → 7 Adar 5788.
      expect(
        nextDays(
          rule('2027-03-16', 'yearly', 'hebrew'),
          '2027-03-17T00:00:00Z',
          1,
        ),
      ).toEqual(['2028-03-05']);
    });

    it('30 Adar I is 29 Adar in a regular year', () => {
      expect(
        nextDays(
          rule('2027-03-09', 'yearly', 'hebrew'),
          '2027-03-10T00:00:00Z',
          1,
        ),
      ).toEqual(['2028-03-27']);
    });

    it('skips a skipped year and carries on', () => {
      const r = rule('2024-11-16', 'yearly', 'hebrew', {
        skipped: [date('2026-10-26')],
      });
      expect(nextDays(r, '2026-01-01T00:00:00Z', 1)).toEqual(['2027-11-15']);
    });
  });

  describe('time zones', () => {
    it('fires at the wall-clock time on each side of a change of the clocks', () => {
      // Israel goes back to winter time (+2) on Sunday 25 Oct 2026.
      const r = rule('2026-10-24', 'daily', 'gregorian', {
        hour: 19,
        minute: 30,
      });
      expect(
        occurrences.nextAfter(r, new Date('2026-10-24T00:00:00Z'), ISRAEL),
      ).toEqual(new Date('2026-10-24T16:30:00Z'));
      expect(
        occurrences.nextAfter(r, new Date('2026-10-24T16:30:00Z'), ISRAEL),
      ).toEqual(new Date('2026-10-25T17:30:00Z'));
    });

    it('uses the time zone it is given', () => {
      const r = rule('2026-10-20', 'daily', 'gregorian', { hour: 8 });
      expect(
        occurrences.nextAfter(r, new Date('2026-10-20T00:00:00Z'), NEW_YORK),
      ).toEqual(
        new Date('2026-10-20T12:00:00Z'), // 08:00 EDT (-4)
      );
    });

    it("the day is the user's, not UTC's", () => {
      // 23:30 Israel on 21 Oct is 20:30Z: still the 21st there, so 08:00 next is on the 22nd.
      const r = rule('2026-10-01', 'daily', 'gregorian', { hour: 8 });
      expect(
        occurrences.nextAfter(r, new Date('2026-10-21T20:30:00Z'), ISRAEL),
      ).toEqual(new Date('2026-10-22T05:00:00Z'));
    });

    it("doesn't depend on the server's own time zone", () => {
      const original = process.env.TZ;
      try {
        process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
        expect(
          nextDays(
            rule('2024-11-16', 'yearly', 'hebrew'),
            '2026-01-01T00:00:00Z',
            1,
          ),
        ).toEqual(['2026-10-26']);
      } finally {
        process.env.TZ = original;
      }
    });
  });
});
