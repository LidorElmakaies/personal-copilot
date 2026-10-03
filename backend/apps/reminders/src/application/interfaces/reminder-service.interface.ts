import type {
  ReminderSettings,
  ReminderStatus,
  ReminderType,
} from '../../models/reminder';

/** Implemented by ReminderService, consumed by RemindersController. */
export interface IReminderService {
  list(userId: string): Promise<ReminderStatus[]>;
  /** Turns the reminder on, or updates it if it exists. */
  save(
    userId: string,
    type: ReminderType,
    settings: ReminderSettings,
  ): Promise<ReminderStatus>;
  /** Keeps the row (and its settings) so turning it back on can prefill them. Idempotent. */
  turnOff(userId: string, type: ReminderType): Promise<void>;
}
