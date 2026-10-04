import type { ReminderDueMessage } from '@app/queue-contracts';
import type { Reminder } from '../../models/reminder';

/** Implemented by ReminderScheduler. See docs/specs/services.md#reminders for the rules. */
export interface IReminderScheduler {
  /**
   * Works out the reminder's next firing, saves it as `next_fire_at` and queues it (or clears it:
   * turned off, or no location yet). `previous` is the `next_fire_at` before this change, whose
   * queued job is removed when it moves.
   */
  schedule(reminder: Reminder, previous?: Date | null): Promise<Reminder>;
  /** Drops the queued job of a reminder that was just turned off. */
  cancel(reminder: Reminder): Promise<void>;
  /** After the user's profile changed (their location may have moved). */
  rescheduleUser(userId: string): Promise<void>;
  /** Every enabled reminder (the sweep); resolves with how many failed. */
  rescheduleAll(): Promise<number>;
  /** A `reminder-due` job ran: request the notification and queue next week's. */
  fire(message: ReminderDueMessage): Promise<void>;
}
