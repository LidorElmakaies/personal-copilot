import type {
  CustomReminder,
  CustomReminderInput,
  CustomReminderInRange,
} from '../../models/custom-reminder';

/** Implemented by CustomReminderService, consumed by CustomRemindersController. Dates are 'YYYY-MM-DD'. */
export interface ICustomReminderService {
  /** Every reminder of the user, each with the days it falls on from `from` to `to`. */
  list(
    userId: string,
    from: string,
    to: string,
  ): Promise<CustomReminderInRange[]>;
  create(userId: string, input: CustomReminderInput): Promise<CustomReminder>;
  /** 404 unless it's this user's. */
  update(
    userId: string,
    id: string,
    patch: Partial<CustomReminderInput>,
  ): Promise<CustomReminder>;
  /** 404 unless it's this user's. */
  remove(userId: string, id: string): Promise<void>;
  /** "Only this day": leaves `date` out. 404 unless it's this user's, 422 if it doesn't fall then. Idempotent. */
  skip(userId: string, id: string, date: string): Promise<CustomReminder>;
}
