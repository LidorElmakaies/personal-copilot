import type { CalendarDay } from './models/calendar-day';
import type { CivilDate } from './models/civil-date';
import type { GeoLocation } from './models/geo-location';
import type { ShabbatTimes } from './models/shabbat-times';

export interface CalculatorOptions {
  candleLightingMinutes: number;
}

/** Implemented by HebcalCalendarCalculator, consumed by ShabbatCalendar and MonthCalendar. */
export interface ICalendarCalculator {
  /** Times for the Shabbat starting on `friday`; null if they can't be computed there (e.g. polar day). */
  shabbatFor(
    location: GeoLocation,
    friday: CivilDate,
    options: CalculatorOptions,
  ): ShabbatTimes | null;
  /** Every day from `first` to `last`, both included. */
  daysFor(
    location: GeoLocation,
    first: CivilDate,
    last: CivilDate,
    options: CalculatorOptions,
  ): CalendarDay[];
}
