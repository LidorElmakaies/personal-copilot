export type NotificationChannel = 'webpush';

/** `notification.requested`, keyed by `userId`. See docs/specs/event-schemas.md. */
export interface NotificationRequestedMessage {
  /** Unique per notification — the consumer skips one it already delivered. */
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
}

const CHANNELS: readonly string[] = ['webpush'] satisfies NotificationChannel[];

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;

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
    isNonEmptyString(m.requestedAt) &&
    !Number.isNaN(Date.parse(m.requestedAt))
  );
}
