export type ReminderType = 'shabbat_candles';

/** One user's reminder of one type, repeating weekly at its offset before the event. */
export interface Reminder {
  id: string;
  userId: string;
  type: ReminderType;
  offsetMinutes: number;
  enabled: boolean;
  /** Set by the scheduler (plan task 2.13); null until then. */
  nextFireAt: Date | null;
}

/** What the user picks; the location comes from their profile (see UserLocation). */
export interface ReminderSettings {
  offsetMinutes: number;
}

/** A reminder plus whether it can fire yet: it can't until the user's location is known. */
export interface ReminderStatus extends Reminder {
  waitingForLocation: boolean;
}
