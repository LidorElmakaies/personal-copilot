import type { PushSubscription } from '../../models/push-subscription';

export type NewPushSubscription = Pick<
  PushSubscription,
  'userId' | 'endpoint' | 'p256dh' | 'auth'
>;

/** Implemented by TypeOrmPushSubscriptionRepository, consumed by PushSubscriptionService. */
export interface IPushSubscriptionRepository {
  /** Inserts, or takes over the row with the same endpoint (new owner and keys). */
  upsertByEndpoint(subscription: NewPushSubscription): Promise<void>;
  deleteByEndpoint(userId: string, endpoint: string): Promise<void>;
}
