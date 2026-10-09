import { ShabbatCalendar } from './shabbat-calendar';

// nextCandleLighting over the real @hebcal/core calculator.
describe('ShabbatCalendar.nextCandleLighting (real hebcal)', () => {
  const calendar = new ShabbatCalendar();
  const TEL_AVIV = {
    latitude: 32.0853,
    longitude: 34.7818,
    timeZone: 'Asia/Jerusalem',
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
      timeZone: 'Europe/Oslo',
    };
    const next = calendar.nextCandleLighting(
      tromso,
      new Date('2026-06-21T12:00:00Z'),
    );
    expect(next.getTime()).toBeGreaterThan(Date.parse('2026-07-01T00:00:00Z'));
  });
});
