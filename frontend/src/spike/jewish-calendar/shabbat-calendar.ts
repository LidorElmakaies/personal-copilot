// SPIKE (R1.1): plain Error instead of @nestjs/common's UnprocessableEntityException.
class UnprocessableEntityException extends Error {}
import type { ICalendarCalculator } from './calendar-calculator.interface';
import { ISRAEL_TIME_ZONE, optionsFor } from './calendar-options';
import { HebcalCalendarCalculator } from './hebcal/hebcal-calendar.calculator';
import {
  addDays,
  civilDateIn,
  weekday,
  type CivilDate,
} from './models/civil-date';
import type { GeoLocation } from './models/geo-location';
import type { ShabbatTimes } from './models/shabbat-times';

export interface ShabbatResult extends ShabbatTimes {
  /** True between candle lighting and Havdalah. */
  isNow: boolean;
}

/** Implemented by ShabbatCalendar. In-process, pure and synchronous — no I/O. */
export interface IShabbatCalendar {
  /** The Shabbat in progress at `now`, otherwise the next one. */
  current(location: GeoLocation, now: Date): ShabbatResult;
  /** The first Friday candle lighting strictly after `after`, skipping weeks with no sunset. */
  nextCandleLighting(location: GeoLocation, after: Date): Date;
}

const FRIDAY = 5;
// Longer than any polar day where people live (Svalbard: ~18 weeks).
const MAX_WEEKS_WITHOUT_SUNSET = 26;

// UnprocessableEntityException (422) when there's no sunset to compute from — an HTTP route passes
// it through as-is.
export class ShabbatCalendar implements IShabbatCalendar {
  constructor(
    private readonly calculator: Pick<
      ICalendarCalculator,
      'shabbatFor'
    > = new HebcalCalendarCalculator(),
  ) {}

  current(location: GeoLocation, now: Date): ShabbatResult {
    const today = civilDateIn(ISRAEL_TIME_ZONE, now);
    const lastFriday = addDays(today, -((weekday(today) - FRIDAY + 7) % 7));

    // Last Friday's Shabbat can still be running (Saturday, or a Yom Tov right after it).
    let times = this.timesFor(location, lastFriday);
    if (now >= times.havdalah)
      times = this.timesFor(location, addDays(lastFriday, 7));

    return {
      ...times,
      isNow: now >= times.candleLighting && now < times.havdalah,
    };
  }

  nextCandleLighting(location: GeoLocation, after: Date): Date {
    // From the last Friday, like current(): west of Israel, that Friday's candle lighting can still
    // be ahead after Israel's date has moved on to Saturday.
    const day = civilDateIn(ISRAEL_TIME_ZONE, after);
    let friday = addDays(day, -((weekday(day) - FRIDAY + 7) % 7));

    for (let week = 0; week < MAX_WEEKS_WITHOUT_SUNSET; week++) {
      const times = this.calculator.shabbatFor(
        location,
        friday,
        optionsFor(location),
      );
      if (times && times.candleLighting > after) return times.candleLighting;
      friday = addDays(friday, 7);
    }
    throw new UnprocessableEntityException(
      "Candle lighting can't be calculated for this location",
    );
  }

  private timesFor(location: GeoLocation, friday: CivilDate): ShabbatTimes {
    const times = this.calculator.shabbatFor(
      location,
      friday,
      optionsFor(location),
    );
    if (!times) {
      throw new UnprocessableEntityException(
        "Shabbat times can't be calculated for this location",
      );
    }
    return times;
  }
}
