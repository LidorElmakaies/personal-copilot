import type {
  CustomReminder,
  CustomReminderInput,
  CustomReminderInRange,
  CustomReminderTiming,
  DateRange,
} from '../../models/custom-reminder';

/** With `range`, a change answers with the reminder's `dates` in it, so a client can show it as is. */
type Changed = CustomReminder | CustomReminderInRange;

/**
 * Implemented by CustomReminderService, consumed by CustomRemindersController. Dates are
 * 'YYYY-MM-DD'; a range is at most MAX_RANGE_DAYS, else 400.
 */
export interface ICustomReminderService {
  /** Every reminder of the user, each with the days it falls on from `from` to `to`. */
  list(userId: string, range: DateRange): Promise<CustomReminderInRange[]>;
  create(
    userId: string,
    input: CustomReminderInput,
    range?: DateRange,
  ): Promise<Changed>;
  /** 404 unless it's this user's. */
  update(
    userId: string,
    id: string,
    patch: Partial<CustomReminderInput>,
    range?: DateRange,
  ): Promise<Changed>;
  /** 404 unless it's this user's. */
  remove(userId: string, id: string): Promise<void>;
  /** Its next few days ('YYYY-MM-DD', Israel), as if saved now; empty when it won't fire again. */
  preview(timing: CustomReminderTiming): string[];
  /** "Only this day": leaves `date` out. 404 unless it's this user's, 422 if it doesn't fall then. Idempotent. */
  skip(
    userId: string,
    id: string,
    date: string,
    range?: DateRange,
  ): Promise<Changed>;
}
