import { randomUUID } from 'crypto';
import type { FcmDevice } from '../src/models/fcm-device';
import type {
  IFcmDeviceRepository,
  NewFcmDevice,
} from '../src/infrastructure/interfaces/fcm-device-repository.interface';

/** Same semantics as the TypeORM repository: token is unique, deleteByToken is owner-scoped. */
export class InMemoryFcmDeviceRepository implements IFcmDeviceRepository {
  /** Keyed by token. */
  readonly rows = new Map<string, FcmDevice>();

  upsertByToken(d: NewFcmDevice): Promise<void> {
    const existing = this.rows.get(d.token);
    this.rows.set(d.token, {
      id: existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      ...d,
    });
    return Promise.resolve();
  }

  deleteByToken(userId: string, token: string): Promise<void> {
    if (this.rows.get(token)?.userId === userId) this.rows.delete(token);
    return Promise.resolve();
  }

  findByUserId(userId: string): Promise<FcmDevice[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((r) => r.userId === userId),
    );
  }

  deleteById(id: string): Promise<void> {
    for (const [token, row] of this.rows) {
      if (row.id === id) this.rows.delete(token);
    }
    return Promise.resolve();
  }
}
