import { Inject, Injectable, Logger } from '@nestjs/common';
import webpush, { WebPushError } from 'web-push';
import { VAPID_CONFIG } from '../../tokens';
import type { VapidConfig } from '../../models/vapid-config';
import type {
  IPushSender,
  PushSendOutcome,
} from '../interfaces/push-sender.interface';

// The only file that imports web-push. Payload encrypted per RFC 8291 (aes128gcm), signed with our VAPID key.
@Injectable()
export class WebPushLibSender implements IPushSender {
  private readonly logger = new Logger(WebPushLibSender.name);

  constructor(@Inject(VAPID_CONFIG) private readonly vapid: VapidConfig) {}

  async send(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: string,
    ttlSeconds: number,
  ): Promise<PushSendOutcome> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        {
          contentEncoding: 'aes128gcm',
          TTL: ttlSeconds,
          vapidDetails: this.vapid,
          timeout: 10_000,
        },
      );
      return 'sent';
    } catch (err) {
      const outcome = classify(err);
      if (outcome !== 'gone') {
        const status =
          err instanceof WebPushError ? err.statusCode : 'no response';
        this.logger.warn(
          `Push to ${new URL(subscription.endpoint).host} ${outcome} (${status}): ${(err as Error).message}`,
        );
      }
      return outcome;
    }
  }
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ECONNABORTED',
]);

function classify(err: unknown): PushSendOutcome {
  if (err instanceof WebPushError) {
    if (err.statusCode === 404 || err.statusCode === 410) return 'gone';
    if (err.statusCode === 429 || err.statusCode >= 500) return 'retry';
    return 'failed';
  }
  // Only a network error or web-push's own timeout is worth retrying; e.g. a crypto error on unusable keys isn't.
  const e = err as { code?: unknown; message?: unknown };
  return (typeof e.code === 'string' && NETWORK_ERROR_CODES.has(e.code)) ||
    e.message === 'Socket timeout'
    ? 'retry'
    : 'failed';
}
