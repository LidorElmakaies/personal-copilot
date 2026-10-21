import type { GeoLocation } from './models/geo-location';

/** A city whose candle lighting differs from Israel's general 20 minutes, matched by distance. */
interface CityCustom {
  name: string;
  latitude: number;
  longitude: number;
  /** Rough city extent: a point this close to the center counts as inside. */
  radiusKm: number;
  candleLightingMinutes: number;
}

const ISRAEL_DEFAULT_MINUTES = 20;

// Source: OU Israel / MyZmanim ("20 mins in most cities; 40 in Jerusalem and Petach Tikva; 30 in
// Tzfat and Haifa"), plus Zikhron Ya'akov 30 (Hebcal; OU lists it with Haifa). Hebcal's own table
// misses Petach Tikva and Tzfat. Radii are approximate: near a border a neighboring town can count
// as the city, or a far edge of it not (see README.md).
const ISRAEL_CITY_CUSTOMS: readonly CityCustom[] = [
  {
    name: 'Jerusalem',
    latitude: 31.7683,
    longitude: 35.2137,
    radiusKm: 10,
    candleLightingMinutes: 40,
  },
  {
    name: 'Petach Tikva',
    latitude: 32.084,
    longitude: 34.8878,
    radiusKm: 3.5, // Givat Shmuel's center is ~3.8 km away, Bnei Brak's ~5 km
    candleLightingMinutes: 40,
  },
  {
    name: 'Haifa',
    latitude: 32.794,
    longitude: 34.9896,
    radiusKm: 8,
    candleLightingMinutes: 30,
  },
  {
    name: 'Tzfat',
    latitude: 32.9646,
    longitude: 35.496,
    radiusKm: 3,
    candleLightingMinutes: 30,
  },
  {
    name: "Zikhron Ya'akov",
    latitude: 32.5707,
    longitude: 34.9539,
    radiusKm: 3,
    candleLightingMinutes: 30,
  },
];

/** Minutes before sunset at a location in Israel: the nearest matching city's custom, else 20. */
export function israelCandleLightingMinutes(location: GeoLocation): number {
  let best: { km: number; minutes: number } | undefined;
  for (const city of ISRAEL_CITY_CUSTOMS) {
    const km = distanceKm(location, city);
    if (km <= city.radiusKm && (!best || km < best.km)) {
      best = { km, minutes: city.candleLightingMinutes };
    }
  }
  return best?.minutes ?? ISRAEL_DEFAULT_MINUTES;
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// Great-circle (haversine) distance.
function distanceKm(
  a: Pick<GeoLocation, 'latitude' | 'longitude'>,
  b: Pick<GeoLocation, 'latitude' | 'longitude'>,
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
