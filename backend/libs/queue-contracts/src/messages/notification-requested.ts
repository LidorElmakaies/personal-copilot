import { isIsoDate, isNonEmptyString } from './validators';

export type NotificationChannel = 'webpush';

/** A job on the `notification-requested` queue. See docs/specs/event-schemas.md. */
export interface NotificationRequestedMessage {
  /** Unique per notification; also the job's deduplication id, so a repeat is dropped until `expiresAt`. */
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  /** Opened when the notification is tapped. */
  url?: string;
  /** Omitted = every channel the user has. */
  channels?: NotificationChannel[];
  /** Publishing service, e.g. 'reminders'. */
  source: string;
  /** ISO 8601. */
  requestedAt: string;
  /** ISO 8601. After this the notification is pointless (e.g. candle lighting has passed): never sent. */
  expiresAt: string;
}

const CHANNELS: readonly string[] = ['webpush'] satisfies NotificationChannel[];

export function isNotificationRequestedMessage(
  value: unknown,
): value is NotificationRequestedMessage {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    isNonEmptyString(m.notificationId) &&
    isNonEmptyString(m.userId) &&
    isNonEmptyString(m.title) &&
    typeof m.body === 'string' &&
    (m.url === undefined || isNonEmptyString(m.url)) &&
    (m.channels === undefined ||
      (Array.isArray(m.channels) &&
        m.channels.every(
          (c) => typeof c === 'string' && CHANNELS.includes(c),
        ))) &&
    isNonEmptyString(m.source) &&
    isIsoDate(m.requestedAt) &&
    isIsoDate(m.expiresAt)
  );
}

// Retries: 30s, 1m, 2m, … ≈ 1h in total; the Notification Service stops earlier once expiresAt passes.
const ATTEMPTS = 8;
const FIRST_RETRY_MS = 30_000;

/** Every publisher must enqueue with these — see docs/specs/event-schemas.md#notification-requested. */
export function notificationRequestedPublishOptions(
  message: NotificationRequestedMessage,
  now = Date.now(),
) {
  return {
    dedupeId: message.notificationId,
    dedupeTtlMs: Math.max(1, Date.parse(message.expiresAt) - now),
    attempts: ATTEMPTS,
    backoffMs: FIRST_RETRY_MS,
  };
}
