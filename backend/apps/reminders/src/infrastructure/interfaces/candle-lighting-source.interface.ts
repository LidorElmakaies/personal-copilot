import type { Coordinates } from '../../models/user-location';

/** Implemented by ShabbatCalendarCandleLightingSource (@app/jewish-calendar), consumed by ReminderScheduler. */
export interface ICandleLightingSource {
  /** The first Friday candle lighting strictly after `after`, at that location. */
  nextAfter(location: Coordinates, after: Date): Promise<Date>;
}
