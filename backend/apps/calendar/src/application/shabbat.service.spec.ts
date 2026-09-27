import { UnprocessableEntityException } from '@nestjs/common';
import { addDays, type CivilDate } from '../models/civil-date';
import type { ShabbatTimes } from '../models/shabbat-times';
import type { ICalendarCalculator } from '../infrastructure/interfaces/calendar-calculator.interface';
import { ShabbatService } from './shabbat.service';

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
  const shabbatFor = jest.fn((_loc, friday: CivilDate): ShabbatTimes => ({
    candleLighting: iso(friday, '15:00:00'),
    havdalah: iso(addDays(friday, havdalahDelayDays), '16:00:00'),
    parasha: null,
    holidays: [],
  }));
  return { shabbatFor } satisfies ICalendarCalculator;
}

describe('ShabbatService.current', () => {
  it('on Sunday returns the coming Friday', () => {
    const calc = fakeCalculator();
    const result = new ShabbatService(calc).current(
      TEL_AVIV,
      new Date('2026-09-27T08:00:00Z'),
    );
    expect(result.candleLighting).toEqual(new Date('2026-10-02T15:00:00Z'));
    expect(result.isNow).toBe(false);
  });

  it('on Friday before candle lighting returns that Friday, not yet in progress', () => {
    const result = new ShabbatService(fakeCalculator()).current(
      TEL_AVIV,
      new Date('2026-10-02T10:00:00Z'),
    );
    expect(result.candleLighting).toEqual(new Date('2026-10-02T15:00:00Z'));
    expect(result.isNow).toBe(false);
  });

  it('between candle lighting and Havdalah is in progress', () => {
    const service = new ShabbatService(fakeCalculator());
    expect(
      service.current(TEL_AVIV, new Date('2026-10-02T16:00:00Z')).isNow,
    ).toBe(true);
    expect(
      service.current(TEL_AVIV, new Date('2026-10-03T12:00:00Z')).isNow,
    ).toBe(true);
  });

  it('after Havdalah moves to next week', () => {
    const result = new ShabbatService(fakeCalculator()).current(
      TEL_AVIV,
      new Date('2026-10-03T17:00:00Z'),
    );
    expect(result.candleLighting).toEqual(new Date('2026-10-09T15:00:00Z'));
    expect(result.isNow).toBe(false);
  });

  it('stays on the current Shabbat through a Yom Tov that follows it', () => {
    // Havdalah on Sunday night, like Simchat Torah abroad.
    const result = new ShabbatService(fakeCalculator(2)).current(
      NEW_YORK,
      new Date('2026-10-04T15:00:00Z'),
    );
    expect(result.candleLighting).toEqual(new Date('2026-10-02T15:00:00Z'));
    expect(result.isNow).toBe(true);
  });

  it("uses the user's local date, not UTC, to find the Friday", () => {
    const calc = fakeCalculator();
    // Friday 22:00 in New York is already Saturday in UTC.
    new ShabbatService(calc).current(
      NEW_YORK,
      new Date('2026-10-03T02:00:00Z'),
    );
    expect(calc.shabbatFor.mock.calls[0][1]).toEqual({
      year: 2026,
      month: 10,
      day: 2,
    });
  });

  it('uses Israel rules and 20 minutes in Israel, 18 minutes abroad', () => {
    const israel = fakeCalculator();
    const abroad = fakeCalculator();
    new ShabbatService(israel).current(
      TEL_AVIV,
      new Date('2026-09-27T08:00:00Z'),
    );
    new ShabbatService(abroad).current(
      NEW_YORK,
      new Date('2026-09-27T08:00:00Z'),
    );
    expect(israel.shabbatFor.mock.calls[0][2]).toEqual({
      israel: true,
      candleLightingMinutes: 20,
    });
    expect(abroad.shabbatFor.mock.calls[0][2]).toEqual({
      israel: false,
      candleLightingMinutes: 18,
    });
  });

  it("rejects a location where times can't be calculated", () => {
    const service = new ShabbatService({ shabbatFor: () => null });
    expect(() => service.current(TEL_AVIV, new Date())).toThrow(
      UnprocessableEntityException,
    );
  });
});
