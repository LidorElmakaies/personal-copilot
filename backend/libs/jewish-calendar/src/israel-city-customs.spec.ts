import { israelCandleLightingMinutes } from './israel-city-customs';
import { ShabbatCalendar } from './shabbat-calendar';

const at = (latitude: number, longitude: number) => ({
  latitude,
  longitude,
  timeZone: 'Asia/Jerusalem',
});

describe('israelCandleLightingMinutes', () => {
  it.each([
    ['central Jerusalem', at(31.7683, 35.2137), 40],
    ['Jerusalem, Gilo (south)', at(31.7333, 35.1833), 40],
    ['Petach Tikva', at(32.084, 34.8878), 40],
    ['Haifa', at(32.794, 34.9896), 30],
    ['Tzfat', at(32.9646, 35.496), 30],
    ["Zikhron Ya'akov", at(32.5707, 34.9539), 30],
    ['Tel Aviv', at(32.0853, 34.7818), 20],
    ['Bnei Brak (next to Petach Tikva)', at(32.0807, 34.8338), 20],
    ['Givat Shmuel (next to Petach Tikva)', at(32.0779, 34.8483), 20],
    ['Rosh Pina (near Tzfat)', at(32.9689, 35.5425), 20],
    ['Beit Shemesh (outside Jerusalem)', at(31.7497, 34.9886), 20],
    ['Eilat', at(29.5577, 34.9519), 20],
  ])('%s → %i minutes', (_name, location, minutes) => {
    expect(israelCandleLightingMinutes(location)).toBe(minutes);
  });
});

// Over the real @hebcal/core: same sunset, so Jerusalem lights 20 minutes earlier than the default.
describe('city customs in candle lighting (real hebcal)', () => {
  const calendar = new ShabbatCalendar();
  const sunday = new Date('2026-10-04T08:00:00Z');

  it('Jerusalem is 40 minutes before sunset', () => {
    expect(calendar.nextCandleLighting(at(31.7683, 35.2137), sunday)).toEqual(
      new Date('2026-10-09T14:34:00.000Z'),
    );
  });

  it('Tel Aviv stays 20 minutes before sunset', () => {
    expect(calendar.nextCandleLighting(at(32.0853, 34.7818), sunday)).toEqual(
      new Date('2026-10-09T14:55:00.000Z'),
    );
  });
});
