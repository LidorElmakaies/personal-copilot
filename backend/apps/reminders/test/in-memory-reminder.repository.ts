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

  findById(id: string): Promise<Reminder | null> {
    const row = [...this.rows.values()].find((r) => r.id === id);
    return Promise.resolve(row ? { ...row } : null);
  }

  findByUserId(userId: string): Promise<Reminder[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((r) => r.userId === userId)
        .map((r) => ({ ...r })),
    );
  }

  findEnabled(): Promise<Reminder[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((r) => r.enabled).map((r) => ({ ...r })),
    );
  }

  setNextFireAt(id: string, nextFireAt: Date | null): Promise<void> {
    const row = [...this.rows.values()].find((r) => r.id === id);
    if (row) row.nextFireAt = nextFireAt;
    return Promise.resolve();
  }

  /** Test helper: as if the account was deleted (ON DELETE CASCADE). */
  deleteUser(userId: string): void {
    for (const [key, r] of this.rows)
      if (r.userId === userId) this.rows.delete(key);
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
    return Promise.resolve({ ...row });
  }

  disable(userId: string, type: ReminderType): Promise<void> {
    const row = this.rows.get(`${userId}:${type}`);
    if (row) Object.assign(row, { enabled: false, nextFireAt: null });
    return Promise.resolve();
  }
}
