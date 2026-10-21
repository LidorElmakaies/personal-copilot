import type { CalculatorOptions } from './calendar-calculator.interface';
import { israelCandleLightingMinutes } from './israel-city-customs';
import type { GeoLocation } from './models/geo-location';

/** The app is Israel-only: Israel's calendar and clock, wherever the location is. */
export const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';

/** Candle-lighting minutes for a location (20, or a city's custom) — every calculation goes through this. */
export function optionsFor(location: GeoLocation): CalculatorOptions {
  return { candleLightingMinutes: israelCandleLightingMinutes(location) };
}
