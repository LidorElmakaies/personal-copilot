import type { CalculatorOptions } from './calendar-calculator.interface';
import { israelCandleLightingMinutes } from './israel-city-customs';
import type { GeoLocation } from './models/geo-location';

// Minutes before sunset abroad; in Israel 20, or a city's custom (israel-city-customs.ts). Set
// explicitly — see this lib's README.md.
const ABROAD_CANDLE_LIGHTING_MINUTES = 18;
const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';

/** Israel rules and candle-lighting minutes for a location — every calculation goes through this. */
export function optionsFor(location: GeoLocation): CalculatorOptions {
  const israel = location.timeZone === ISRAEL_TIME_ZONE;
  return {
    israel,
    candleLightingMinutes: israel
      ? israelCandleLightingMinutes(location)
      : ABROAD_CANDLE_LIGHTING_MINUTES,
  };
}
