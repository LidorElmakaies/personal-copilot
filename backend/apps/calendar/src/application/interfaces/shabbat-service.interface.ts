import type { GeoLocation } from '../../models/geo-location';
import type { ShabbatTimes } from '../../models/shabbat-times';

export interface ShabbatResult extends ShabbatTimes {
  /** True between candle lighting and Havdalah. */
  isNow: boolean;
}

/** Implemented by ShabbatService, consumed by ShabbatController. */
export interface IShabbatService {
  /** The Shabbat in progress at `now`, otherwise the next one. */
  current(location: GeoLocation, now: Date): ShabbatResult;

  /** The first Friday candle lighting strictly after `after`, skipping weeks with no sunset. */
  nextCandleLighting(location: GeoLocation, after: Date): Date;
}
