import { getMonth, getShabbat } from './calendarService';
// What Gateway answered (its CalendarController over the backend's lib, as JSON) for Tel Aviv:
// Shabbat asked on Wed 21 Oct 2026 and on Sat 24 Oct 2026 (in progress), and September 2026
// (Rosh Hashana, Yom Kippur, Sukkot).
import gateway from './gateway-answers.fixture.json';

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };

describe('calendarService', () => {
  afterEach(() => jest.useRealTimers());

  it('gives the Shabbat Gateway gave, times as ISO strings', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-21T09:00:00Z'));
    await expect(getShabbat(TEL_AVIV)).resolves.toStrictEqual(gateway.shabbat);
  });

  it('says when Shabbat is on now', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T10:00:00Z'));
    await expect(getShabbat(TEL_AVIV)).resolves.toStrictEqual(
      gateway.shabbatNow,
    );
  });

  it('gives the month Gateway gave', async () => {
    const month = await getMonth(TEL_AVIV, 2026, 9);
    expect(month).toStrictEqual(gateway.month);
    expect(typeof month.days[0].date).toBe('string');
  });

  it("rejects with the lib's message where there's no sunset", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-20T09:00:00Z'));
    await expect(
      getShabbat({ latitude: 89.9, longitude: 0 }),
    ).rejects.toThrow("Shabbat times can't be calculated for this location");
  });

  it('rejects what Gateway refused with 400', async () => {
    await expect(
      getShabbat({ latitude: 91, longitude: 0 }),
    ).rejects.toThrow('lat must be a latitude');
    await expect(getMonth(TEL_AVIV, 2026, 13)).rejects.toThrow('month must');
    await expect(getMonth(TEL_AVIV, 1899, 1)).rejects.toThrow('year must');
  });
});
