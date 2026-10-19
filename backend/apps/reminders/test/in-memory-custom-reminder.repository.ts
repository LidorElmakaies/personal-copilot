import { randomUUID } from 'crypto';
import type {
  CustomReminder,
  CustomReminderInput,
} from '../src/models/custom-reminder';
import type { ICustomReminderRepository } from '../src/infrastructure/interfaces/custom-reminder-repository.interface';

/** Same semantics as the TypeORM repository. */
export class InMemoryCustomReminderRepository implements ICustomReminderRepository {
  readonly rows = new Map<string, CustomReminder>();

  findByUserId(userId: string): Promise<CustomReminder[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((r) => r.userId === userId)
        .map((r) => this.copy(r)),
    );
  }

  findOwned(userId: string, id: string): Promise<CustomReminder | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row?.userId === userId ? this.copy(row) : null);
  }

  countByUserId(userId: string): Promise<number> {
    return Promise.resolve(
      [...this.rows.values()].filter((r) => r.userId === userId).length,
    );
  }

  create(userId: string, input: CustomReminderInput): Promise<CustomReminder> {
    const now = new Date();
    const row: CustomReminder = {
      ...input,
      id: randomUUID(),
      userId,
      skipped: [],
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return Promise.resolve(this.copy(row));
  }

  update(
    userId: string,
    id: string,
    patch: Partial<CustomReminderInput> & { skipped?: string[] },
  ): Promise<CustomReminder | null> {
    const row = this.rows.get(id);
    if (row?.userId !== userId) return Promise.resolve(null);
    Object.assign(row, patch, { updatedAt: new Date() });
    return Promise.resolve(this.copy(row));
  }

  delete(userId: string, id: string): Promise<boolean> {
    if (this.rows.get(id)?.userId !== userId) return Promise.resolve(false);
    return Promise.resolve(this.rows.delete(id));
  }

  /** Test helper: as if the account was deleted (ON DELETE CASCADE). */
  deleteUser(userId: string): void {
    for (const [id, r] of this.rows)
      if (r.userId === userId) this.rows.delete(id);
  }

  private copy(r: CustomReminder): CustomReminder {
    return { ...r, skipped: [...r.skipped] };
  }
}
