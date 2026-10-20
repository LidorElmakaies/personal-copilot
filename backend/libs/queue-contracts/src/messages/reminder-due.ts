import { isIsoDate, isNonEmptyString } from './validators';

/** A candle-lighting reminder's firing. Jobs queued before `kind` existed have none. */
export interface CandleLightingDueMessage {
  kind?: 'shabbat_candles';
  reminderId: string;
  /** ISO 8601 — when it should fire; must still equal the reminder's `next_fire_at` when it runs. */
  fireAt: string;
  /** ISO 8601 — the candle lighting it's for; the notification expires then. */
  candleLighting: string;
}

/** A user's own (custom) reminder's firing. */
export interface CustomReminderDueMessage {
  kind: 'custom';
  reminderId: string;
  /** ISO 8601 — when it should fire; must still equal the reminder's `next_fire_at` when it runs. */
  fireAt: string;
}

/** A job on the `reminder-due` queue: one reminder's next firing. See docs/specs/event-schemas.md. */
export type ReminderDueMessage =
  CandleLightingDueMessage | CustomReminderDueMessage;

export function isReminderDueMessage(
  value: unknown,
): value is ReminderDueMessage {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  if (!isNonEmptyString(m.reminderId) || !isIsoDate(m.fireAt)) return false;
  if (m.kind === 'custom') return true;
  return (
    (m.kind === undefined || m.kind === 'shabbat_candles') &&
    isIsoDate(m.candleLighting)
  );
}

/** One job per reminder and fire time, so scheduling the same firing twice adds it once. */
export function reminderDueJobId(reminderId: string, fireAt: Date): string {
  return `${reminderId}_${fireAt.getTime()}`;
}

// Retries: 30s, 1m, 2m, … — a Redis or database hiccup at fire time shouldn't lose the reminder.
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
