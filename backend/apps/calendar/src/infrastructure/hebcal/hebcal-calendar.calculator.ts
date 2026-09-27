import { Injectable } from '@nestjs/common';
// Subpath, not the package root: the root only exports `import`, which a CJS require() never matches.
import {
  CandleLightingEvent,
  flags,
  HavdalahEvent,
  HebrewCalendar,
  HolidayEvent,
  Location,
  ParshaEvent,
  type Event,
} from '@hebcal/core/dist/esm/index';
import { addDays, type CivilDate } from '../../models/civil-date';
import type { GeoLocation } from '../../models/geo-location';
import type { LocalizedName, ShabbatTimes } from '../../models/shabbat-times';
import type {
  CalculatorOptions,
  ICalendarCalculator,
} from '../interfaces/calendar-calculator.interface';

// Covers Shabbat followed by a two-day Yom Tov abroad (Havdalah on Monday night).
const HAVDALAH_SEARCH_DAYS = 3;

@Injectable()
export class HebcalCalendarCalculator implements ICalendarCalculator {
  shabbatFor(
    location: GeoLocation,
    friday: CivilDate,
    options: CalculatorOptions,
  ): ShabbatTimes | null {
    const saturday = addDays(friday, 1);
    const events = HebrewCalendar.calendar({
      start: toHebcalDate(friday),
      end: toHebcalDate(addDays(saturday, HAVDALAH_SEARCH_DAYS)),
      location: new Location(
        location.latitude,
        location.longitude,
        options.israel,
        location.timeZone,
      ),
      il: options.israel,
      candlelighting: true,
      candleLightingMins: options.candleLightingMinutes,
      sedrot: true,
    });

    const onFriday = events.filter((e) => isOn(e, friday));
    const onSaturday = events.filter((e) => isOn(e, saturday));
    const candleLighting = onFriday.find(
      (e) => e instanceof CandleLightingEvent,
    )?.eventTime;
    const havdalah = events.find(
      (e): e is HavdalahEvent => e instanceof HavdalahEvent && !isOn(e, friday),
    )?.eventTime;
    if (!candleLighting || !havdalah) return null;

    const parasha = onSaturday.find((e) => e instanceof ParshaEvent);
    const holidays = onSaturday.filter(
      (e): e is HolidayEvent => e instanceof HolidayEvent && labelsShabbat(e),
    );

    return {
      candleLighting,
      havdalah,
      parasha: parasha ? names(parasha) : null,
      holidays: holidays.map(names),
    };
  }
}

// Drops entries that don't describe the Shabbat day itself: eves, modern civic days, Saturday-night Selichot.
function labelsShabbat(event: HolidayEvent): boolean {
  if (event.getFlags() & (flags.EREV | flags.MODERN_HOLIDAY)) return false;
  return event.getDesc() !== 'Leil Selichot';
}

// hebcal reads a Date's local Y/M/D fields, so build it from local fields too — correct in any server TZ.
function toHebcalDate(date: CivilDate): Date {
  return new Date(date.year, date.month - 1, date.day);
}

function isOn(event: Event, date: CivilDate): boolean {
  const g = event.getDate().greg();
  return (
    g.getFullYear() === date.year &&
    g.getMonth() + 1 === date.month &&
    g.getDate() === date.day
  );
}

function names(event: Event): LocalizedName {
  return { en: event.render('en'), he: event.render('he-x-NoNikud') };
}
