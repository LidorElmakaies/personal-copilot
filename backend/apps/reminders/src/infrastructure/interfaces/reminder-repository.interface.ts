import type {
  Reminder,
  ReminderSettings,
  ReminderType,
} from '../../models/reminder';

/** Implemented by TypeOrmReminderRepository, consumed by ReminderService and ReminderScheduler. */
export interface IReminderRepository {
  findById(id: string): Promise<Reminder | null>;
  findByUserId(userId: string): Promise<Reminder[]>;
  findEnabled(): Promise<Reminder[]>;
  setNextFireAt(id: string, nextFireAt: Date | null): Promise<void>;
  /** One row per user and type: inserts or overwrites it, enabled, with next_fire_at cleared. */
  upsertEnabled(
    userId: string,
    type: ReminderType,
    settings: ReminderSettings,
  ): Promise<Reminder>;
  /** No-op if the user has no such reminder. */
  disable(userId: string, type: ReminderType): Promise<void>;
}
