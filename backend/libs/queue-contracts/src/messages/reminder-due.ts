/** A job on the `reminder-due` queue: one reminder's next firing. See docs/specs/event-schemas.md. */
export interface ReminderDueMessage {
  reminderId: string;
  /** ISO 8601 — when it should fire; must still equal the reminder's `next_fire_at` when it runs. */
  fireAt: string;
  /** ISO 8601 — the candle lighting it's for; the notification expires then. */
  candleLighting: string;
}

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;

const isIsoDate = (v: unknown): v is string =>
  isNonEmptyString(v) && !Number.isNaN(Date.parse(v));

export function isReminderDueMessage(
  value: unknown,
): value is ReminderDueMessage {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    isNonEmptyString(m.reminderId) &&
    isIsoDate(m.fireAt) &&
    isIsoDate(m.candleLighting)
  );
}

/** One job per reminder and fire time, so scheduling the same firing twice adds it once. */
export function reminderDueJobId(reminderId: string, fireAt: Date): string {
  return `${reminderId}_${fireAt.getTime()}`;
}

// Retries: 30s, 1m, 2m, … — a Calendar or Redis hiccup at fire time shouldn't lose the reminder.
const ATTEMPTS = 8;
const FIRST_RETRY_MS = 30_000;

/** Every publisher must enqueue with these — see docs/specs/event-schemas.md#reminder-due. */
export function reminderDuePublishOptions(
  message: ReminderDueMessage,
  now = Date.now(),
) {
  const fireAt = new Date(message.fireAt);
  return {
    jobId: reminderDueJobId(message.reminderId, fireAt),
    delayMs: Math.max(0, fireAt.getTime() - now),
    attempts: ATTEMPTS,
    backoffMs: FIRST_RETRY_MS,
  };
}
