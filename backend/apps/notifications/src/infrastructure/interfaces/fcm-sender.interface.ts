import type { PushSendOutcome } from './push-sender.interface';

/** Implemented by FcmHttpSender, consumed by FcmChannel. Sends one data-only message to one device.
 * 'gone' = the token is dead (unregistered, invalid, another Firebase project's); 'retry' =
 * 429/5xx/401/no response; 'failed' = anything else. */
export interface IFcmSender {
  /** Never throws. */
  send(
    token: string,
    data: Record<string, string>,
    /** How long FCM may hold it for an unreachable device. */
    ttlSeconds: number,
  ): Promise<PushSendOutcome>;
}
