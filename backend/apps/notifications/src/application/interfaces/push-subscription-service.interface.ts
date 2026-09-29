export interface SubscribeInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Implemented by PushSubscriptionService, consumed by PushSubscriptionsController. */
export interface IPushSubscriptionService {
  vapidPublicKey(): string;
  /** Idempotent; an endpoint already registered moves to this user (whoever is signed in on that browser now). */
  subscribe(userId: string, input: SubscribeInput): Promise<void>;
  /** Idempotent; only removes the endpoint if this user owns it. */
  unsubscribe(userId: string, endpoint: string): Promise<void>;
}
