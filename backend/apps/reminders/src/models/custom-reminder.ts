import type { ReminderCalendar, ReminderRepeat } from '@app/jewish-calendar';

/** A user's own reminder: a title at a wall-clock time, once or repeating (see ReminderOccurrences). */
export interface CustomReminder {
  id: string;
  userId: string;
  title: string;
  hour: number;
  minute: number;
  repeat: ReminderRepeat;
  calendar: ReminderCalendar;
  /** 'YYYY-MM-DD' — the day it starts, in the user's own calendar date. */
  start: string;
  /** 'YYYY-MM-DD' days it's left out on ("only this day"), oldest first. */
  skipped: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** What the user sets. */
export type CustomReminderInput = Pick<
  CustomReminder,
  'title' | 'hour' | 'minute' | 'repeat' | 'calendar' | 'start'
>;

/** A reminder and the days it falls on in the range asked for. */
export interface CustomReminderInRange extends CustomReminder {
  dates: string[];
}
