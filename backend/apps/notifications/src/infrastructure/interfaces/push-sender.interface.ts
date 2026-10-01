import type { PushSubscription } from '../../models/push-subscription';

/** 'gone' = 404/410 (subscription dead); 'retry' = 429/5xx/no response; 'failed' = anything else. */
export type PushSendOutcome = 'sent' | 'gone' | 'retry' | 'failed';

/** Implemented by WebPushLibSender, consumed by WebPushChannel. Encrypts and sends one push. */
export interface IPushSender {
  /** Never throws. */
  send(
    subscription: Pick<PushSubscription, 'endpoint' | 'p256dh' | 'auth'>,
    payload: string,
    /** How long the push service may hold it for an unreachable device; 0 = now or never. */
    ttlSeconds: number,
  ): Promise<PushSendOutcome>;
}
