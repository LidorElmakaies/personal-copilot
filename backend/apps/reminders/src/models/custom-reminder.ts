import type {
  CivilDate,
  ReminderCalendar,
  ReminderRepeat,
  ReminderRule,
} from '@app/jewish-calendar';

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
  /** When its queued `reminder-due` job fires; null when it has no more occurrences. */
  nextFireAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What the user sets. */
export type CustomReminderInput = Pick<
  CustomReminder,
  'title' | 'hour' | 'minute' | 'repeat' | 'calendar' | 'start'
>;

/** When it fires, without the title — what the add sheet's preview is asked for. */
export type CustomReminderTiming = Omit<CustomReminderInput, 'title'>;

/** A reminder and the days it falls on in the range asked for. */
export interface CustomReminderInRange extends CustomReminder {
  dates: string[];
}

/** 'YYYY-MM-DD' to 'YYYY-MM-DD', both included — the months a client shows. */
export interface DateRange {
  from: string;
  to: string;
}

/** 'YYYY-MM-DD' → CivilDate. */
export const civilDate = (s: string): CivilDate => {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
};

/** The rule ReminderOccurrences works on; `withSkips: false` ignores its skipped days. */
export const ruleOf = (
  r: CustomReminderTiming & Pick<CustomReminder, 'skipped'>,
  withSkips = true,
): ReminderRule => ({
  start: civilDate(r.start),
  hour: r.hour,
  minute: r.minute,
  repeat: r.repeat,
  calendar: r.calendar,
  skipped: withSkips ? r.skipped.map(civilDate) : [],
});
