import { randomUUID } from 'crypto';
import type { PushSubscription } from '../src/models/push-subscription';
import type {
  IPushSubscriptionRepository,
  NewPushSubscription,
} from '../src/infrastructure/interfaces/push-subscription-repository.interface';

/** Same semantics as the TypeORM repository: endpoint is unique, deleteByEndpoint is owner-scoped. */
export class InMemoryPushSubscriptionRepository implements IPushSubscriptionRepository {
  /** Keyed by endpoint. */
  readonly rows = new Map<string, PushSubscription>();

  upsertByEndpoint(s: NewPushSubscription): Promise<void> {
    const existing = this.rows.get(s.endpoint);
    this.rows.set(s.endpoint, {
      id: existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? new Date(),
      ...s,
    });
    return Promise.resolve();
  }

  deleteByEndpoint(userId: string, endpoint: string): Promise<void> {
    if (this.rows.get(endpoint)?.userId === userId) this.rows.delete(endpoint);
    return Promise.resolve();
  }

  findByUserId(userId: string): Promise<PushSubscription[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((r) => r.userId === userId),
    );
  }

  findById(id: string): Promise<PushSubscription | null> {
    return Promise.resolve(
      [...this.rows.values()].find((r) => r.id === id) ?? null,
    );
  }

  deleteById(id: string): Promise<void> {
    for (const [endpoint, row] of this.rows) {
      if (row.id === id) this.rows.delete(endpoint);
    }
    return Promise.resolve();
  }
}
