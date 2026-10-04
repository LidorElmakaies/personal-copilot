import { HebcalCalendarCalculator } from './hebcal-calendar.calculator';

// Pins @hebcal/core's output for known weeks, so a library upgrade that shifts times shows up here.
const calculator = new HebcalCalendarCalculator();
const TEL_AVIV = {
  latitude: 32.0853,
  longitude: 34.7818,
  timeZone: 'Asia/Jerusalem',
};
const NEW_YORK = {
  latitude: 40.7128,
  longitude: -74.006,
  timeZone: 'America/New_York',
};
const TROMSO = {
  latitude: 69.6492,
  longitude: 18.9553,
  timeZone: 'Europe/Oslo',
};
const ISRAEL = { israel: true, candleLightingMinutes: 20 };
const ABROAD = { israel: false, candleLightingMinutes: 18 };

describe('HebcalCalendarCalculator.shabbatFor', () => {
  it('a regular week in Tel Aviv: times and parasha', () => {
    const times = calculator.shabbatFor(
      TEL_AVIV,
      { year: 2026, month: 10, day: 9 },
      ISRAEL,
    );
    expect(times).toEqual({
      candleLighting: new Date('2026-10-09T14:55:00Z'), // 17:55 local (sunset 18:15)
      havdalah: new Date('2026-10-10T15:51:00Z'), // 18:51 local
      parasha: { en: 'Parashat Bereshit', he: 'פרשת בראשית' },
      holidays: [],
    });
  });

  it('a Shabbat that is also a holiday: no parasha, holiday listed', () => {
    const times = calculator.shabbatFor(
      TEL_AVIV,
      { year: 2026, month: 10, day: 2 },
      ISRAEL,
    );
    expect(times?.parasha).toBeNull();
    expect(times?.holidays).toEqual([
      { en: 'Shmini Atzeret', he: 'שמיני עצרת' },
    ]);
    expect(times?.havdalah).toEqual(new Date('2026-10-03T16:00:00Z'));
  });

  it('lists every label that applies, but skips modern civic days and Selichot', () => {
    const at = (month: number, day: number, year = 2027) =>
      calculator
        .shabbatFor(TEL_AVIV, { year, month, day }, ISRAEL)
        ?.holidays.map((h) => h.en);
    expect(at(1, 22)).toEqual(['Tu BiShvat', 'Shabbat Shirah']);
    expect(at(4, 16)).toEqual(['Shabbat HaGadol']); // not Yom HaAliyah
    expect(at(9, 24)).toEqual([]); // not Leil Selichot
  });

  it('abroad, Havdalah waits for the Yom Tov after Shabbat to end', () => {
    const times = calculator.shabbatFor(
      NEW_YORK,
      { year: 2026, month: 10, day: 2 },
      ABROAD,
    );
    expect(times?.candleLighting).toEqual(new Date('2026-10-02T22:18:00Z'));
    expect(times?.havdalah).toEqual(new Date('2026-10-04T23:13:00Z')); // Sunday night
  });

  it('returns null where the sun never sets', () => {
    expect(
      calculator.shabbatFor(TROMSO, { year: 2026, month: 6, day: 19 }, ABROAD),
    ).toBeNull();
  });

  it("doesn't depend on the server's own time zone", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
      const times = calculator.shabbatFor(
        TEL_AVIV,
        { year: 2026, month: 10, day: 9 },
        ISRAEL,
      );
      expect(times?.candleLighting).toEqual(new Date('2026-10-09T14:55:00Z'));
    } finally {
      process.env.TZ = original;
    }
  });
});
