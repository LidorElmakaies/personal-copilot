import type { ICalendarCalculator } from './calendar-calculator.interface';
import { MonthCalendar } from './month-calendar';

describe('MonthCalendar.month', () => {
  const daysFor = jest.fn<
    ReturnType<ICalendarCalculator['daysFor']>,
    Parameters<ICalendarCalculator['daysFor']>
  >(() => []);
  const calendar = new MonthCalendar({ daysFor });
  const TEL_AVIV = {
    latitude: 32.0853,
    longitude: 34.7818,
    timeZone: 'Asia/Jerusalem',
  };

  beforeEach(() => daysFor.mockClear());

  it.each([
    [2026, 9, { year: 2026, month: 9, day: 30 }],
    [2026, 12, { year: 2026, month: 12, day: 31 }], // across the year end
    [2027, 2, { year: 2027, month: 2, day: 28 }],
    [2028, 2, { year: 2028, month: 2, day: 29 }], // leap year
  ])('asks for %i-%i from the 1st to the last day', (year, month, last) => {
    calendar.month(TEL_AVIV, year, month);
    expect(daysFor.mock.calls[0][1]).toEqual({ year, month, day: 1 });
    expect(daysFor.mock.calls[0][2]).toEqual(last);
  });

  it('applies Israel rules from the time zone, like ShabbatCalendar', () => {
    calendar.month(TEL_AVIV, 2026, 9);
    expect(daysFor.mock.calls[0][3]).toEqual({
      israel: true,
      candleLightingMinutes: 20,
    });
    calendar.month(
      { latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' },
      2026,
      9,
    );
    expect(daysFor.mock.calls[1][3]).toEqual({
      israel: false,
      candleLightingMinutes: 18,
    });
  });
});
