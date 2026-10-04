import { UnprocessableEntityException } from '@nestjs/common';
import type { ICalendarCalculator } from './calendar-calculator.interface';
import { addDays, type CivilDate } from './models/civil-date';
import type { ShabbatTimes } from './models/shabbat-times';
import { ShabbatCalendar } from './shabbat-calendar';

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

const iso = (d: CivilDate, time: string) =>
  new Date(
    `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}T${time}Z`,
  );

// Candles Fri 15:00Z, Havdalah Sat 16:00Z (or later via havdalahDelayDays).
function fakeCalculator(havdalahDelayDays = 1) {
  // Typed with shabbatFor's full parameters, so tests can read the options it was called with.
  const shabbatFor = jest.fn<
    ShabbatTimes,
    Parameters<ICalendarCalculator['shabbatFor']>
  >((_loc, friday: CivilDate): ShabbatTimes => ({
    candleLighting: iso(friday, '15:00:00'),
    havdalah: iso(addDays(friday, havdalahDelayDays), '16:00:00'),
    parasha: null,
    holidays: [],
  }));
  return { shabbatFor } satisfies ICalendarCalculator;
}

describe('ShabbatCalendar.current', () => {
  it('on Sunday returns the coming Friday', () => {
    const calc = fakeCalculator();
    const result = new ShabbatCalendar(calc).current(
      TEL_AVIV,
      new Date('2026-09-27T08:00:00Z'),
    );
    expect(result.candleLighting).toEqual(new Date('2026-10-02T15:00:00Z'));
    expect(result.isNow).toBe(false);
  });

  it('on Friday before candle lighting returns that Friday, not yet in progress', () => {
    const result = new ShabbatCalendar(fakeCalculator()).current(
      TEL_AVIV,
      new Date('2026-10-02T10:00:00Z'),
    );
    expect(result.candleLighting).toEqual(new Date('2026-10-02T15:00:00Z'));
    expect(result.isNow).toBe(false);
  });

  it('between candle lighting and Havdalah is in progress', () => {
    const service = new ShabbatCalendar(fakeCalculator());
    expect(
      service.current(TEL_AVIV, new Date('2026-10-02T16:00:00Z')).isNow,
    ).toBe(true);
    expect(
      service.current(TEL_AVIV, new Date('2026-10-03T12:00:00Z')).isNow,
    ).toBe(true);
  });

  it('after Havdalah moves to next week', () => {
    const result = new ShabbatCalendar(fakeCalculator()).current(
      TEL_AVIV,
      new Date('2026-10-03T17:00:00Z'),
    );
    expect(result.candleLighting).toEqual(new Date('2026-10-09T15:00:00Z'));
    expect(result.isNow).toBe(false);
  });

  it('stays on the current Shabbat through a Yom Tov that follows it', () => {
    // Havdalah on Sunday night, like Simchat Torah abroad.
    const result = new ShabbatCalendar(fakeCalculator(2)).current(
      NEW_YORK,
      new Date('2026-10-04T15:00:00Z'),
    );
    expect(result.candleLighting).toEqual(new Date('2026-10-02T15:00:00Z'));
    expect(result.isNow).toBe(true);
  });

  it("uses the user's local date, not UTC, to find the Friday", () => {
    const calc = fakeCalculator();
    // Friday 22:00 in New York is already Saturday in UTC.
    new ShabbatCalendar(calc).current(
      NEW_YORK,
      new Date('2026-10-03T02:00:00Z'),
    );
    expect(calc.shabbatFor.mock.calls[0][1]).toEqual({
      year: 2026,
      month: 10,
      day: 2,
    });
  });

  it("rejects a location where times can't be calculated", () => {
    const service = new ShabbatCalendar({ shabbatFor: () => null });
    expect(() => service.current(TEL_AVIV, new Date())).toThrow(
      UnprocessableEntityException,
    );
  });
});

describe('ShabbatCalendar.nextCandleLighting', () => {
  const next = (after: string, calc = fakeCalculator()) =>
    new ShabbatCalendar(calc).nextCandleLighting(TEL_AVIV, new Date(after));

  it('uses Israel rules and 20 minutes in Israel, 18 minutes abroad', () => {
    const israel = fakeCalculator();
    const abroad = fakeCalculator();
    const sunday = new Date('2026-09-27T08:00:00Z');
    new ShabbatCalendar(israel).nextCandleLighting(TEL_AVIV, sunday);
    new ShabbatCalendar(abroad).nextCandleLighting(NEW_YORK, sunday);
    expect(israel.shabbatFor.mock.calls[0][2]).toEqual({
      israel: true,
      candleLightingMinutes: 20,
    });
    expect(abroad.shabbatFor.mock.calls[0][2]).toEqual({
      israel: false,
      candleLightingMinutes: 18,
    });
  });

  it('on Sunday returns the coming Friday', () => {
    expect(next('2026-09-27T08:00:00Z')).toEqual(
      new Date('2026-10-02T15:00:00Z'),
    );
  });

  it('on Friday before candle lighting returns that Friday', () => {
    expect(next('2026-10-02T14:59:59Z')).toEqual(
      new Date('2026-10-02T15:00:00Z'),
    );
  });

  it('is strictly after: exactly at candle lighting returns next week', () => {
    expect(next('2026-10-02T15:00:00Z')).toEqual(
      new Date('2026-10-09T15:00:00Z'),
    );
  });

  it('during Shabbat returns next week, not the one in progress', () => {
    expect(next('2026-10-03T12:00:00Z')).toEqual(
      new Date('2026-10-09T15:00:00Z'),
    );
  });

  it("uses the user's local date, not UTC, to find the Friday", () => {
    const calc = fakeCalculator();
    // Thursday 22:00 in New York is already Friday in UTC.
    new ShabbatCalendar(calc).nextCandleLighting(
      NEW_YORK,
      new Date('2026-10-02T02:00:00Z'),
    );
    expect(calc.shabbatFor.mock.calls[0][1]).toEqual({
      year: 2026,
      month: 10,
      day: 2,
    });
  });

  it('skips weeks with no sunset', () => {
    const calc = fakeCalculator();
    const shabbatFor = jest.fn<
      ShabbatTimes | null,
      Parameters<ICalendarCalculator['shabbatFor']>
    >((loc, friday, options) =>
      friday.day === 2 ? null : calc.shabbatFor(loc, friday, options),
    );
    const result = new ShabbatCalendar({ shabbatFor }).nextCandleLighting(
      TEL_AVIV,
      new Date('2026-09-27T08:00:00Z'),
    );
    expect(result).toEqual(new Date('2026-10-09T15:00:00Z'));
  });

  it('gives up with 422 after half a year without sunset', () => {
    const shabbatFor = jest.fn(() => null);
    expect(() =>
      new ShabbatCalendar({ shabbatFor }).nextCandleLighting(
        TEL_AVIV,
        new Date(),
      ),
    ).toThrow(UnprocessableEntityException);
    expect(shabbatFor).toHaveBeenCalledTimes(26);
  });
});
