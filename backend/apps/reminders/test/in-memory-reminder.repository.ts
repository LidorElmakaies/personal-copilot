import { randomUUID } from 'crypto';
import type {
  Reminder,
  ReminderSettings,
  ReminderType,
} from '../src/models/reminder';
import type { IReminderRepository } from '../src/infrastructure/interfaces/reminder-repository.interface';

/** Same semantics as the TypeORM repository: one row per (userId, type). */
export class InMemoryReminderRepository implements IReminderRepository {
  /** Keyed by `${userId}:${type}`. */
  readonly rows = new Map<string, Reminder>();

  findByUserId(userId: string): Promise<Reminder[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((r) => r.userId === userId),
    );
  }

  upsertEnabled(
    userId: string,
    type: ReminderType,
    settings: ReminderSettings,
  ): Promise<Reminder> {
    const key = `${userId}:${type}`;
    const row: Reminder = {
      id: this.rows.get(key)?.id ?? randomUUID(),
      userId,
      type,
      ...settings,
      enabled: true,
      nextFireAt: null,
    };
    this.rows.set(key, row);
    return Promise.resolve(row);
  }

  disable(userId: string, type: ReminderType): Promise<void> {
    const row = this.rows.get(`${userId}:${type}`);
    if (row) Object.assign(row, { enabled: false, nextFireAt: null });
    return Promise.resolve();
  }
}
