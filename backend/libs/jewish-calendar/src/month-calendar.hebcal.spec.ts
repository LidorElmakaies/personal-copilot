import { MonthCalendar } from './month-calendar';
import { ShabbatCalendar } from './shabbat-calendar';
import type { CalendarDay } from './models/calendar-day';

// September 2026 (Elul 5786 – Tishrei 5787) over the real @hebcal/core calculator: Rosh Hashana,
// Tzom Gedaliah, Yom Kippur and Sukkot — whose second day is Yom Tov abroad, Chol HaMoed in Israel.
describe('MonthCalendar (real hebcal)', () => {
  const calendar = new MonthCalendar();
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
  const israel = calendar.month(TEL_AVIV, 2026, 9);
  const abroad = calendar.month(NEW_YORK, 2026, 9);
  const day = (m: { days: CalendarDay[] }, date: string) =>
    m.days.find((d) => d.date === date)!;
  const kinds = (d: CalendarDay) => d.times.map((t) => t.kind);
  const named = (d: CalendarDay, en: string) =>
    d.events.find((e) => e.name.en === en);

  it('has every day of the month, in order', () => {
    expect(israel.days).toHaveLength(30);
    expect(israel.days[0].date).toBe('2026-09-01');
    expect(israel.days[29].date).toBe('2026-09-30');
    expect({ year: israel.year, month: israel.month }).toEqual({
      year: 2026,
      month: 9,
    });
  });

  it('gives each day its Hebrew date, in Hebrew letters too', () => {
    expect(day(israel, '2026-09-12').hebrew).toEqual({
      day: 1,
      dayHe: 'א׳',
      month: { en: 'Tishrei', he: 'תשרי' },
      year: 5787,
      yearHe: 'תשפ״ז',
    });
    expect(day(israel, '2026-09-11').hebrew.month.en).toBe('Elul');
  });

  it('marks a fast with when it begins and ends', () => {
    const gedaliah = day(israel, '2026-09-14');
    expect(named(gedaliah, 'Tzom Gedaliah')?.kind).toBe('fast');
    expect(kinds(gedaliah)).toEqual(['fastBegins', 'fastEnds']);
    expect(gedaliah.times[0].at.getTime()).toBeLessThan(
      gedaliah.times[1].at.getTime(),
    );
  });

  it('has candle lighting on the eve and Havdalah when Yom Kippur ends', () => {
    expect(kinds(day(israel, '2026-09-20'))).toEqual(['candleLighting']);
    const kippur = day(israel, '2026-09-21');
    expect(named(kippur, 'Yom Kippur')?.kind).toBe('yomTov');
    expect(kinds(kippur)).toEqual(['havdalah']);
  });

  it('in Israel, Sukkot II is Chol HaMoed: one day of Yom Tov, no times on the 27th', () => {
    expect(kinds(day(israel, '2026-09-26'))).toEqual(['havdalah']);
    const second = day(israel, '2026-09-27');
    expect(second.events.map((e) => e.kind)).toEqual(['holiday']);
    expect(second.times).toEqual([]);
  });

  it('abroad, Sukkot II is Yom Tov too: candles on the first night out, Havdalah after the second', () => {
    expect(kinds(day(abroad, '2026-09-26'))).toEqual(['candleLighting']);
    const second = day(abroad, '2026-09-27');
    expect(named(second, 'Sukkot II')?.kind).toBe('yomTov');
    expect(kinds(second)).toEqual(['havdalah']);
  });

  it("has Saturday's parasha, and none on other days", () => {
    expect(day(israel, '2026-09-19').parasha).toEqual({
      en: 'Parashat Ha’azinu',
      he: 'פרשת האזינו',
    });
    expect(day(israel, '2026-09-18').parasha).toBeNull();
  });

  it("agrees with ShabbatCalendar on a week's candle lighting and Havdalah", () => {
    const shabbat = new ShabbatCalendar().current(
      TEL_AVIV,
      new Date('2026-09-16T12:00:00Z'),
    );
    expect(day(israel, '2026-09-18').times).toEqual([
      { kind: 'candleLighting', at: shabbat.candleLighting },
    ]);
    expect(day(israel, '2026-09-19').times).toEqual([
      { kind: 'havdalah', at: shabbat.havdalah },
    ]);
  });
});

// Cases outside September 2026, same locations and the same real calculator.
describe('MonthCalendar (real hebcal), other months', () => {
  const calendar = new MonthCalendar();
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
  const day = (m: { days: CalendarDay[] }, date: string) =>
    m.days.find((d) => d.date === date)!;
  const kinds = (d: CalendarDay) => d.times.map((t) => t.kind);
  const events = (d: CalendarDay) => d.events.map((e) => [e.kind, e.name.en]);

  it('Shemini Atzeret and Simchat Torah: one day in Israel, two abroad with candles on the second night', () => {
    const israel = calendar.month(TEL_AVIV, 2026, 10);
    expect(events(day(israel, '2026-10-03'))).toEqual([
      ['yomTov', 'Shmini Atzeret'],
    ]);
    expect(kinds(day(israel, '2026-10-03'))).toEqual(['havdalah']);
    expect(day(israel, '2026-10-04').events).toEqual([]);

    const abroad = calendar.month(NEW_YORK, 2026, 10);
    expect(kinds(day(abroad, '2026-10-02'))).toEqual(['candleLighting']);
    expect(kinds(day(abroad, '2026-10-03'))).toEqual(['candleLighting']);
    expect(events(day(abroad, '2026-10-04'))).toEqual([
      ['yomTov', 'Simchat Torah'],
    ]);
    expect(kinds(day(abroad, '2026-10-04'))).toEqual(['havdalah']);
  });

  it("Tish'a B'Av begins the evening before: fastBegins on 8 Av, fastEnds on 9 Av", () => {
    const july = calendar.month(TEL_AVIV, 2026, 7);
    const eve = day(july, '2026-07-22');
    const fast = day(july, '2026-07-23');
    expect(kinds(eve)).toEqual(['fastBegins']);
    expect(events(eve)).toEqual([['holiday', 'Erev Tish’a B’Av']]); // the eve isn't the fast day
    expect(events(fast)).toEqual([['fast', 'Tish’a B’Av']]);
    expect(kinds(fast)).toEqual(['fastEnds']);
    expect(eve.times[0].at.getTime()).toBeLessThan(fast.times[0].at.getTime());
  });

  it('names both Adars of a Hebrew leap year, in Hebrew too', () => {
    const march = calendar.month(TEL_AVIV, 2027, 3); // 5787 is a leap year
    expect(day(march, '2027-03-09').hebrew.month).toEqual({
      en: 'Adar I',
      he: 'אדר א׳',
    });
    expect(day(march, '2027-03-10').hebrew).toMatchObject({
      day: 1,
      month: { en: 'Adar II', he: 'אדר ב׳' },
    });
  });

  it("leaves out hebcal's other timed entries, e.g. Chanukah candles", () => {
    // Sunday 6 Dec 2026: hebcal gives a timed "Chanukah: 3 Candles" — not an enter/leave time.
    const sunday = day(calendar.month(NEW_YORK, 2026, 12), '2026-12-06');
    expect(events(sunday)).toEqual([['holiday', 'Chanukah: 3 Candles']]);
    expect(sunday.times).toEqual([]);
  });
});
