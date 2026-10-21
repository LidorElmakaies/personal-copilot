// SPIKE (R1.1): package root — Metro resolves its exports' `import` condition.
import {
  CandleLightingEvent,
  flags,
  gematriya,
  HavdalahEvent,
  HDate,
  HebrewCalendar,
  HolidayEvent,
  Locale,
  Location,
  ParshaEvent,
  TimedEvent,
  type Event,
} from '@hebcal/core';
import type {
  CalendarDay,
  CalendarEventKind,
  CalendarTime,
  CalendarTimeKind,
  HebrewDate,
} from '../models/calendar-day';
import { holidayName } from '../holiday-names';
import { addDays, type CivilDate } from '../models/civil-date';
import type { GeoLocation } from '../models/geo-location';
import type { LocalizedName, ShabbatTimes } from '../models/shabbat-times';
import type {
  CalculatorOptions,
  ICalendarCalculator,
} from '../calendar-calculator.interface';
import { ISRAEL_TIME_ZONE } from '../calendar-options';

// Covers Shabbat followed by a Yom Tov on Sunday (Havdalah on Sunday night), with a day to spare.
const HAVDALAH_SEARCH_DAYS = 3;

export class HebcalCalendarCalculator implements ICalendarCalculator {
  shabbatFor(
    location: GeoLocation,
    friday: CivilDate,
    options: CalculatorOptions,
  ): ShabbatTimes | null {
    const saturday = addDays(friday, 1);
    const events = eventsBetween(
      location,
      friday,
      addDays(saturday, HAVDALAH_SEARCH_DAYS),
      options,
    );

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
      holidays: holidays.map(holidayNames),
    };
  }

  daysFor(
    location: GeoLocation,
    first: CivilDate,
    last: CivilDate,
    options: CalculatorOptions,
  ): CalendarDay[] {
    const events = eventsBetween(location, first, last, options);
    const days: CalendarDay[] = [];
    for (let date = first; !isAfter(date, last); date = addDays(date, 1)) {
      const onDay = events.filter((e) => isOn(e, date));
      const parasha = onDay.find((e) => e instanceof ParshaEvent);
      const holidays = onDay.filter(
        (e): e is HolidayEvent => e instanceof HolidayEvent,
      );
      days.push({
        date: isoDate(date),
        hebrew: hebrewDate(date),
        events: holidays.map((e) => ({
          kind: eventKind(e),
          name: holidayNames(e),
        })),
        parasha: parasha ? names(parasha) : null,
        times: yomKippurTimes(
          holidays.map((e) => e.getDesc()),
          onDay.flatMap((e) => {
            const kind = timeKind(e);
            return kind && e instanceof TimedEvent
              ? [{ kind, at: e.eventTime }]
              : [];
          }),
        ),
      });
    }
    return days;
  }
}

function eventsBetween(
  location: GeoLocation,
  start: CivilDate,
  end: CivilDate,
  options: CalculatorOptions,
): Event[] {
  return HebrewCalendar.calendar({
    start: toHebcalDate(start),
    end: toHebcalDate(end),
    location: new Location(
      location.latitude,
      location.longitude,
      true,
      ISRAEL_TIME_ZONE,
    ),
    il: true,
    candlelighting: true,
    candleLightingMins: options.candleLightingMinutes,
    sedrot: true,
  });
}

function eventKind(event: HolidayEvent): CalendarEventKind {
  const f = event.getFlags();
  // An eve isn't the fast itself, even Erev Tish'a B'Av (flagged MAJOR_FAST): the fast's own day is.
  if (f & flags.EREV) return 'holiday';
  if (f & flags.CHAG) return 'yomTov';
  if (f & (flags.MAJOR_FAST | flags.MINOR_FAST)) return 'fast';
  return 'holiday';
}

// Chanukah's candles and other timed entries aren't enter/leave times — left out.
function timeKind(event: Event): CalendarTimeKind | null {
  if (event instanceof CandleLightingEvent) return 'candleLighting';
  if (event instanceof HavdalahEvent) return 'havdalah';
  if (event.getDesc() === 'Fast begins') return 'fastBegins';
  if (event.getDesc() === 'Fast ends') return 'fastEnds';
  return null;
}

// hebcal gives Yom Kippur only candle lighting and Havdalah; it's a fast, so say so: the fast
// begins with the eve's candle lighting and ends at that Havdalah.
function yomKippurTimes(
  descs: string[],
  times: CalendarTime[],
): CalendarTime[] {
  if (descs.includes('Erev Yom Kippur')) {
    const candles = times.find((t) => t.kind === 'candleLighting');
    if (candles) return [...times, { kind: 'fastBegins', at: candles.at }];
  }
  if (descs.includes('Yom Kippur')) {
    return times.map((t) =>
      t.kind === 'havdalah' ? { kind: 'fastEnds', at: t.at } : t,
    );
  }
  return times;
}

function hebrewDate(date: CivilDate): HebrewDate {
  const hd = new HDate(toHebcalDate(date));
  const month = hd.getMonthName();
  return {
    day: hd.getDate(),
    dayHe: gematriya(hd.getDate()),
    month: { en: month, he: Locale.gettext(month, 'he-x-NoNikud') },
    year: hd.getFullYear(),
    yearHe: gematriya(hd.getFullYear()),
  };
}

function isAfter(a: CivilDate, b: CivilDate): boolean {
  return isoDate(a) > isoDate(b);
}

function isoDate(d: CivilDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
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

function holidayNames(event: HolidayEvent): LocalizedName {
  return holidayName(event.getDesc(), names(event));
}
