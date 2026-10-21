import type { ICalendarCalculator } from './calendar-calculator.interface';
import { optionsFor } from './calendar-options';
import { HebcalCalendarCalculator } from './hebcal/hebcal-calendar.calculator';
import type { CalendarDay } from './models/calendar-day';
import { addDays } from './models/civil-date';
import type { GeoLocation } from './models/geo-location';

export interface CalendarMonth {
  year: number;
  month: number; // 1-12
  days: CalendarDay[];
}

/** Implemented by MonthCalendar. In-process, pure and synchronous — no I/O. */
export interface IMonthCalendar {
  /** Every day of a civil month with its Hebrew date, holidays/fasts and times at `location`. */
  month(location: GeoLocation, year: number, month: number): CalendarMonth;
}

export class MonthCalendar implements IMonthCalendar {
  constructor(
    private readonly calculator: Pick<
      ICalendarCalculator,
      'daysFor'
    > = new HebcalCalendarCalculator(),
  ) {}

  month(location: GeoLocation, year: number, month: number): CalendarMonth {
    const first = { year, month, day: 1 };
    const last = addDays(
      month === 12
        ? { year: year + 1, month: 1, day: 1 }
        : { year, month: month + 1, day: 1 },
      -1,
    );
    return {
      year,
      month,
      days: this.calculator.daysFor(
        location,
        first,
        last,
        optionsFor(location),
      ),
    };
  }
}
