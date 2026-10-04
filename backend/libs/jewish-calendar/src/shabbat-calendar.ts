import { UnprocessableEntityException } from '@nestjs/common';
import type {
  CalculatorOptions,
  ICalendarCalculator,
} from './calendar-calculator.interface';
import { HebcalCalendarCalculator } from './hebcal/hebcal-calendar.calculator';
import { israelCandleLightingMinutes } from './israel-city-customs';
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
// Minutes before sunset abroad; in Israel 20, or a city's custom (israel-city-customs.ts). Set
// explicitly — see this lib's README.md.
const ABROAD_CANDLE_LIGHTING_MINUTES = 18;
const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';
// Longer than any polar day where people live (Svalbard: ~18 weeks).
const MAX_WEEKS_WITHOUT_SUNSET = 26;

// UnprocessableEntityException (422) when there's no sunset to compute from — an HTTP route passes
// it through as-is.
export class ShabbatCalendar implements IShabbatCalendar {
  constructor(
    private readonly calculator: ICalendarCalculator = new HebcalCalendarCalculator(),
  ) {}

  current(location: GeoLocation, now: Date): ShabbatResult {
    const today = civilDateIn(location.timeZone, now);
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
    const day = civilDateIn(location.timeZone, after);
    let friday = addDays(day, (FRIDAY - weekday(day) + 7) % 7);

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

function optionsFor(location: GeoLocation): CalculatorOptions {
  const israel = location.timeZone === ISRAEL_TIME_ZONE;
  return {
    israel,
    candleLightingMinutes: israel
      ? israelCandleLightingMinutes(location)
      : ABROAD_CANDLE_LIGHTING_MINUTES,
  };
}
