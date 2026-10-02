import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CALENDAR_CALCULATOR } from '../tokens';
import type {
  CalculatorOptions,
  ICalendarCalculator,
} from '../infrastructure/interfaces/calendar-calculator.interface';
import {
  addDays,
  civilDateIn,
  weekday,
  type CivilDate,
} from '../models/civil-date';
import type { GeoLocation } from '../models/geo-location';
import type { ShabbatTimes } from '../models/shabbat-times';
import type {
  IShabbatService,
  ShabbatResult,
} from './interfaces/shabbat-service.interface';

const FRIDAY = 5;
// Minutes before sunset, set explicitly — see backend/apps/calendar/README.md.
const CANDLE_LIGHTING_MINUTES = { israel: 20, abroad: 18 };
const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';
// Longer than any polar day where people live (Svalbard: ~18 weeks).
const MAX_WEEKS_WITHOUT_SUNSET = 26;

@Injectable()
export class ShabbatService implements IShabbatService {
  constructor(
    @Inject(CALENDAR_CALCULATOR)
    private readonly calculator: ICalendarCalculator,
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
      ? CANDLE_LIGHTING_MINUTES.israel
      : CANDLE_LIGHTING_MINUTES.abroad,
  };
}
