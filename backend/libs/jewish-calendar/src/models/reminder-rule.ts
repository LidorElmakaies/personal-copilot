import type { CivilDate } from './civil-date';

export type ReminderRepeat = 'once' | 'daily' | 'monthly' | 'yearly';
export type ReminderCalendar = 'gregorian' | 'hebrew';

/** When a user's own reminder fires — wall-clock time in their time zone. */
export interface ReminderRule {
  /** The day it starts; a once-reminder's only day. */
  start: CivilDate;
  hour: number; // 0-23
  minute: number; // 0-59
  repeat: ReminderRepeat;
  /** The calendar a monthly or yearly reminder follows; ignored for once and daily. */
  calendar: ReminderCalendar;
  /** Days it's left out on ("only this day"). */
  skipped?: CivilDate[];
}
