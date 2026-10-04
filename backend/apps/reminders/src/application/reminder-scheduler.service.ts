import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IQueuePublisher } from '@app/queue-client';
import {
  notificationRequestedPublishOptions,
  QUEUES,
  reminderDueJobId,
  reminderDuePublishOptions,
  type NotificationRequestedMessage,
  type ReminderDueMessage,
} from '@app/queue-contracts';
import {
  CANDLE_LIGHTING_SOURCE,
  QUEUE_PUBLISHER,
  REMINDER_REPOSITORY,
  USER_LOCATION_READER,
} from '../tokens';
import type { Reminder } from '../models/reminder';
import type { ICandleLightingSource } from '../infrastructure/interfaces/candle-lighting-source.interface';
import type { IReminderRepository } from '../infrastructure/interfaces/reminder-repository.interface';
import type { IUserLocationReader } from '../infrastructure/interfaces/user-location-reader.interface';
import type { IReminderScheduler } from './interfaces/reminder-scheduler.interface';

interface Firing {
  fireAt: Date;
  candleLighting: Date;
}

@Injectable()
export class ReminderScheduler implements IReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminders: IReminderRepository,
    @Inject(USER_LOCATION_READER)
    private readonly locations: IUserLocationReader,
    @Inject(CANDLE_LIGHTING_SOURCE)
    private readonly calendar: ICandleLightingSource,
    @Inject(QUEUE_PUBLISHER) private readonly queue: IQueuePublisher,
  ) {}

  async schedule(
    reminder: Reminder,
    previous: Date | null = reminder.nextFireAt,
  ): Promise<Reminder> {
    const next = reminder.enabled ? await this.nextFiring(reminder) : null;
    return this.apply(reminder, next, previous);
  }

  async cancel(reminder: Reminder): Promise<void> {
    if (reminder.nextFireAt)
      await this.removeJob(reminder.id, reminder.nextFireAt);
  }

  async rescheduleUser(userId: string): Promise<void> {
    for (const r of await this.reminders.findByUserId(userId)) {
      if (r.enabled) await this.schedule(r);
    }
  }

  async rescheduleAll(): Promise<number> {
    let failed = 0;
    for (const r of await this.reminders.findEnabled()) {
      try {
        await this.schedule(r);
      } catch (err) {
        failed++;
        this.logger.warn(`Couldn't schedule reminder ${r.id}: ${String(err)}`);
      }
    }
    return failed;
  }

  async fire(message: ReminderDueMessage): Promise<void> {
    const reminder = await this.reminders.findById(message.reminderId);
    // Deleted (account gone), turned off, or moved since this job was queued: nothing to do.
    if (
      !reminder?.enabled ||
      reminder.nextFireAt?.getTime() !== Date.parse(message.fireAt)
    ) {
      return;
    }
    const candleLighting = new Date(message.candleLighting);
    if (new Date() < candleLighting) {
      await this.requestNotification(reminder, candleLighting);
    }
    // Safe to repeat on a retry: the notification and the next job are both deduplicated.
    const next = await this.nextFiring(reminder, candleLighting);
    await this.apply(reminder, next, null); // this job is the one running — nothing to remove
  }

  /**
   * The first candle lighting at the user's location whose fire time (candle lighting − offset) is
   * still ahead — or, when it already passed but this exact firing is still pending (the service
   * was down), that one, so it fires late rather than not at all. Null without a location.
   */
  private async nextFiring(
    reminder: Reminder,
    after?: Date,
  ): Promise<Firing | null> {
    const location = await this.locations.findByUserId(reminder.userId);
    if (!location) return null;
    const now = new Date();
    let candleLighting = await this.calendar.nextAfter(location, after ?? now);
    let fireAt = this.fireTime(reminder, candleLighting);
    const missed =
      !after && reminder.nextFireAt?.getTime() === fireAt.getTime();
    if (fireAt <= now && !missed) {
      candleLighting = await this.calendar.nextAfter(location, candleLighting);
      fireAt = this.fireTime(reminder, candleLighting);
    }
    return { fireAt, candleLighting };
  }

  private fireTime(reminder: Reminder, candleLighting: Date): Date {
    return new Date(candleLighting.getTime() - reminder.offsetMinutes * 60_000);
  }

  private async apply(
    reminder: Reminder,
    next: Firing | null,
    previous: Date | null,
  ): Promise<Reminder> {
    const nextFireAt = next?.fireAt ?? null;
    if (previous && previous.getTime() !== nextFireAt?.getTime()) {
      await this.removeJob(reminder.id, previous);
    }
    if (next) {
      const message: ReminderDueMessage = {
        reminderId: reminder.id,
        fireAt: next.fireAt.toISOString(),
        candleLighting: next.candleLighting.toISOString(),
      };
      await this.queue.publish(
        QUEUES.REMINDER_DUE,
        message,
        reminderDuePublishOptions(message, Date.now()),
      );
    }
    if (reminder.nextFireAt?.getTime() !== nextFireAt?.getTime()) {
      await this.reminders.setNextFireAt(reminder.id, nextFireAt);
    }
    return { ...reminder, nextFireAt };
  }

  private removeJob(reminderId: string, fireAt: Date): Promise<void> {
    return this.queue.remove(
      QUEUES.REMINDER_DUE,
      reminderDueJobId(reminderId, fireAt),
    );
  }

  private async requestNotification(
    reminder: Reminder,
    candleLighting: Date,
  ): Promise<void> {
    const now = new Date();
    const tz =
      (await this.locations.findByUserId(reminder.userId))?.tz ?? 'UTC';
    const at = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    }).format(candleLighting);
    const minutesLeft = Math.round(
      (candleLighting.getTime() - now.getTime()) / 60_000,
    );
    const message: NotificationRequestedMessage = {
      // One per reminder and candle lighting — a retried or repeated firing is dropped as a duplicate.
      notificationId: `reminder-${reminder.id}-${candleLighting.getTime()}`,
      userId: reminder.userId,
      title: 'Shabbat candle lighting',
      body: `Candle lighting is at ${at} (in ${formatMinutes(minutesLeft)}).`,
      url: '/',
      source: 'reminders',
      requestedAt: now.toISOString(),
      expiresAt: candleLighting.toISOString(),
    };
    await this.queue.publish(
      QUEUES.NOTIFICATION_REQUESTED,
      message,
      notificationRequestedPublishOptions(message, now.getTime()),
    );
  }
}

/** 90 → "1 h 30 min", 120 → "2 h", 45 → "45 min". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
