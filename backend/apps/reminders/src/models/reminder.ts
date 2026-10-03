export type ReminderType = 'shabbat_candles';

/** One user's reminder of one type, repeating weekly at its offset before the event. */
export interface Reminder {
  id: string;
  userId: string;
  type: ReminderType;
  offsetMinutes: number;
  lat: number;
  lon: number;
  tz: string;
  enabled: boolean;
  /** Set by the scheduler (plan task 2.6); null until then. */
  nextFireAt: Date | null;
}

/** What the user picks; the rest is derived. */
export interface ReminderSettings {
  offsetMinutes: number;
  lat: number;
  lon: number;
  tz: string;
}
