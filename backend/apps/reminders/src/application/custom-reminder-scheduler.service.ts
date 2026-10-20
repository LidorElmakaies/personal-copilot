import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ISRAEL_TIME_ZONE,
  type IReminderOccurrences,
} from '@app/jewish-calendar';
import type { IQueuePublisher } from '@app/queue-client';
import {
  notificationRequestedPublishOptions,
  QUEUES,
  reminderDueJobId,
  reminderDuePublishOptions,
  type CustomReminderDueMessage,
  type NotificationRequestedMessage,
} from '@app/queue-contracts';
import {
  CUSTOM_REMINDER_REPOSITORY,
  QUEUE_PUBLISHER,
  REMINDER_OCCURRENCES,
} from '../tokens';
import { ruleOf, type CustomReminder } from '../models/custom-reminder';
import type { ICustomReminderRepository } from '../infrastructure/interfaces/custom-reminder-repository.interface';
import type { ICustomReminderScheduler } from './interfaces/custom-reminder-scheduler.interface';

/** A firing this late (the service was down) is dropped; the next one is still queued. */
export const LATE_LIMIT_MS = 60 * 60_000;

// The app is Israel-only: every reminder's wall-clock time is Israel's, whatever the user's location.
const TZ = ISRAEL_TIME_ZONE;

@Injectable()
export class CustomReminderScheduler implements ICustomReminderScheduler {
  private readonly logger = new Logger(CustomReminderScheduler.name);

  constructor(
    @Inject(CUSTOM_REMINDER_REPOSITORY)
    private readonly reminders: ICustomReminderRepository,
    @Inject(REMINDER_OCCURRENCES)
    private readonly occurrences: IReminderOccurrences,
    @Inject(QUEUE_PUBLISHER) private readonly queue: IQueuePublisher,
  ) {}

  async schedule(
    reminder: CustomReminder,
    previous: Date | null = reminder.nextFireAt,
  ): Promise<CustomReminder> {
    return this.apply(reminder, this.nextFiring(reminder), previous);
  }

  async cancel(reminder: CustomReminder): Promise<void> {
    if (reminder.nextFireAt)
      await this.removeJob(reminder.id, reminder.nextFireAt);
  }

  async rescheduleAll(): Promise<number> {
    let failed = 0;
    for (const r of await this.reminders.findAll()) {
      try {
        await this.schedule(r);
      } catch (err) {
        failed++;
        this.logger.warn(
          `Couldn't schedule custom reminder ${r.id}: ${String(err)}`,
        );
      }
    }
    return failed;
  }

  async fire(message: CustomReminderDueMessage): Promise<void> {
    const reminder = await this.reminders.findById(message.reminderId);
    // Deleted, or moved since this job was queued: nothing to do.
    if (
      !reminder ||
      reminder.nextFireAt?.getTime() !== Date.parse(message.fireAt)
    ) {
      return;
    }
    const fireAt = new Date(message.fireAt);
    if (Date.now() < fireAt.getTime() + LATE_LIMIT_MS) {
      await this.requestNotification(reminder, fireAt);
    }
    // Safe to repeat on a retry: the notification and the next job are both deduplicated.
    // From now when late, so occurrences missed meanwhile aren't queued one by one.
    const after = new Date(Math.max(fireAt.getTime(), Date.now()));
    const next = this.occurrences.nextAfter(ruleOf(reminder), after, TZ);
    await this.apply(reminder, next, null); // this job is the one running — nothing to remove
  }

  /**
   * The first occurrence still ahead, at its wall-clock time in Israel — or, when the pending one
   * already passed without firing (the service was down) and the reminder still falls then, that
   * one, so it fires late rather than not at all. Null when it has no more occurrences.
   */
  private nextFiring(reminder: CustomReminder): Date | null {
    const rule = ruleOf(reminder);
    const now = new Date();
    const pending = reminder.nextFireAt;
    // Only while it would still notify: a failed job keeps its id in Redis, so re-adding it does nothing.
    if (
      pending &&
      pending <= now &&
      now.getTime() < pending.getTime() + LATE_LIMIT_MS
    ) {
      const stillDue = this.occurrences.nextAfter(
        rule,
        new Date(pending.getTime() - 1),
        TZ,
      );
      if (stillDue?.getTime() === pending.getTime()) return pending;
    }
    return this.occurrences.nextAfter(rule, now, TZ);
  }

  private async apply(
    reminder: CustomReminder,
    next: Date | null,
    previous: Date | null,
  ): Promise<CustomReminder> {
    if (previous && previous.getTime() !== next?.getTime()) {
      await this.removeJob(reminder.id, previous);
    }
    if (next) {
      const message: CustomReminderDueMessage = {
        kind: 'custom',
        reminderId: reminder.id,
        fireAt: next.toISOString(),
      };
      await this.queue.publish(
        QUEUES.REMINDER_DUE,
        message,
        reminderDuePublishOptions(message, Date.now()),
      );
    }
    if (reminder.nextFireAt?.getTime() !== next?.getTime()) {
      await this.reminders.setNextFireAt(reminder.id, next);
    }
    return { ...reminder, nextFireAt: next };
  }

  private removeJob(reminderId: string, fireAt: Date): Promise<void> {
    return this.queue.remove(
      QUEUES.REMINDER_DUE,
      reminderDueJobId(reminderId, fireAt),
    );
  }

  private async requestNotification(
    reminder: CustomReminder,
    fireAt: Date,
  ): Promise<void> {
    const now = new Date();
    const at = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
    }).format(fireAt);
    const message: NotificationRequestedMessage = {
      // One per reminder and firing — a retried or repeated firing is dropped as a duplicate.
      notificationId: `custom-reminder-${reminder.id}-${fireAt.getTime()}`,
      userId: reminder.userId,
      title: reminder.title,
      body: `Your reminder for ${at}.`,
      url: '/calendar',
      source: 'reminders',
      requestedAt: now.toISOString(),
      expiresAt: new Date(fireAt.getTime() + LATE_LIMIT_MS).toISOString(),
    };
    await this.queue.publish(
      QUEUES.NOTIFICATION_REQUESTED,
      message,
      notificationRequestedPublishOptions(message, now.getTime()),
    );
  }
}
