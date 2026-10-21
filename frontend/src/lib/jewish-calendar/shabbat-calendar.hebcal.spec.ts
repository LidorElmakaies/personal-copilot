import { ShabbatCalendar } from './shabbat-calendar';

// nextCandleLighting over the real @hebcal/core calculator.
describe('ShabbatCalendar.nextCandleLighting (real hebcal)', () => {
  const calendar = new ShabbatCalendar();
  const TEL_AVIV = {
    latitude: 32.0853,
    longitude: 34.7818,
  };

  it('from a Saturday during Shmini Atzeret, gives next Friday (Bereshit)', () => {
    expect(
      calendar.nextCandleLighting(TEL_AVIV, new Date('2026-10-03T12:00:00Z')),
    ).toEqual(new Date('2026-10-09T14:55:00.000Z'));
  });

  it('is strictly after `after`: at that candle lighting, gives the week after', () => {
    expect(
      calendar.nextCandleLighting(TEL_AVIV, new Date('2026-10-09T14:55:00Z')),
    ).toEqual(new Date('2026-10-16T14:47:00.000Z'));
  });

  it('skips the polar summer instead of failing', () => {
    const tromso = {
      latitude: 69.6492,
      longitude: 18.9553,
    };
    const next = calendar.nextCandleLighting(
      tromso,
      new Date('2026-06-21T12:00:00Z'),
    );
    expect(next.getTime()).toBeGreaterThan(Date.parse('2026-07-01T00:00:00Z'));
  });
});

// Israel-only: Israel's calendar and Israel's "today", at any point's own sunset.
describe('ShabbatCalendar.current (real hebcal, Israel only)', () => {
  const calendar = new ShabbatCalendar();
  const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
  const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };

  it('Sunday of Rosh Hashana II (5787) is still the Shabbat that began Friday', () => {
    const result = calendar.current(TEL_AVIV, new Date('2026-09-13T10:00:00Z'));
    expect(result).toMatchObject({
      candleLighting: new Date('2026-09-11T15:32:00.000Z'),
      havdalah: new Date('2026-09-13T16:26:00.000Z'), // Sunday night, after one more day
      isNow: true,
    });
  });

  it("after Rosh Hashana II's Havdalah, moves to the next Friday", () => {
    const result = calendar.current(TEL_AVIV, new Date('2026-09-13T16:30:00Z'));
    expect(result.candleLighting.toISOString().slice(0, 10)).toBe('2026-09-18');
    expect(result.isNow).toBe(false);
  });

  it("abroad, Friday afternoon after Israel's midnight is still this Friday", () => {
    // 17:30 in New York = 00:30 Saturday in Israel; candles there at 18:16 local.
    const result = calendar.current(NEW_YORK, new Date('2026-10-02T21:30:00Z'));
    expect(result.candleLighting).toEqual(new Date('2026-10-02T22:16:00.000Z'));
    expect(result.isNow).toBe(false);
  });
});

describe('ShabbatCalendar.nextCandleLighting (real hebcal, a point abroad)', () => {
  const calendar = new ShabbatCalendar();
  const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };

  // West of Israel, this Friday's candle lighting can still be ahead after Israel's midnight.
  it("abroad, Friday afternoon after Israel's midnight gives this Friday's", () => {
    expect(
      calendar.nextCandleLighting(NEW_YORK, new Date('2026-10-02T21:30:00Z')),
    ).toEqual(new Date('2026-10-02T22:16:00.000Z'));
  });
});
