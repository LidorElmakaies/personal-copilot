import type { CustomReminderDueMessage } from '@app/queue-contracts';
import type { CustomReminder } from '../../models/custom-reminder';

/** Implemented by CustomReminderScheduler. See docs/specs/services.md#reminders for the rules. */
export interface ICustomReminderScheduler {
  /**
   * Works out the reminder's next firing, saves it as `next_fire_at` and queues it (or clears it:
   * no more occurrences). `previous` is the `next_fire_at` before this change,
   * whose queued job is removed when it moves.
   */
  schedule(
    reminder: CustomReminder,
    previous?: Date | null,
  ): Promise<CustomReminder>;
  /** Drops the queued job of a reminder that was just deleted. */
  cancel(reminder: CustomReminder): Promise<void>;
  /** Every custom reminder (the sweep); resolves with how many failed. */
  rescheduleAll(): Promise<number>;
  /** A `reminder-due` job of kind `custom` ran: request the notification and queue the next. */
  fire(message: CustomReminderDueMessage): Promise<void>;
}
