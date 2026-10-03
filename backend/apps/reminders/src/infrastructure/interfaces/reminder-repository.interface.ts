import type {
  Reminder,
  ReminderSettings,
  ReminderType,
} from '../../models/reminder';

/** Implemented by TypeOrmReminderRepository, consumed by ReminderService. */
export interface IReminderRepository {
  findByUserId(userId: string): Promise<Reminder[]>;
  /** One row per user and type: inserts or overwrites it, enabled, with next_fire_at cleared. */
  upsertEnabled(
    userId: string,
    type: ReminderType,
    settings: ReminderSettings,
  ): Promise<Reminder>;
  /** No-op if the user has no such reminder. */
  disable(userId: string, type: ReminderType): Promise<void>;
}
