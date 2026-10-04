import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  REMINDER_REPOSITORY,
  REMINDER_SCHEDULER,
  USER_LOCATION_READER,
} from '../tokens';
import type {
  Reminder,
  ReminderSettings,
  ReminderStatus,
  ReminderType,
} from '../models/reminder';
import type { IReminderRepository } from '../infrastructure/interfaces/reminder-repository.interface';
import type { IUserLocationReader } from '../infrastructure/interfaces/user-location-reader.interface';
import type { IReminderScheduler } from './interfaces/reminder-scheduler.interface';
import type { IReminderService } from './interfaces/reminder-service.interface';

@Injectable()
export class ReminderService implements IReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminders: IReminderRepository,
    @Inject(USER_LOCATION_READER)
    private readonly locations: IUserLocationReader,
    @Inject(REMINDER_SCHEDULER)
    private readonly scheduler: IReminderScheduler,
  ) {}

  async list(userId: string): Promise<ReminderStatus[]> {
    const [reminders, waiting] = await Promise.all([
      this.reminders.findByUserId(userId),
      this.waitingForLocation(userId),
    ]);
    return reminders.map((r) => this.withStatus(r, waiting));
  }

  async save(
    userId: string,
    type: ReminderType,
    settings: ReminderSettings,
  ): Promise<ReminderStatus> {
    const before = await this.find(userId, type);
    let reminder = await this.reminders.upsertEnabled(userId, type, settings);
    // The setting is saved either way; a Redis failure here is fixed by the next sweep
    // (ReminderSweeper, every 15 min).
    try {
      reminder = await this.scheduler.schedule(
        reminder,
        before?.nextFireAt ?? null,
      );
    } catch (err) {
      this.logger.warn(
        `Couldn't schedule reminder ${reminder.id}: ${String(err)}`,
      );
    }
    return this.withStatus(reminder, await this.waitingForLocation(userId));
  }

  async turnOff(userId: string, type: ReminderType): Promise<void> {
    const before = await this.find(userId, type);
    await this.reminders.disable(userId, type);
    // Best-effort tidy-up: a leftover job finds the reminder off and does nothing.
    if (before) {
      await this.scheduler
        .cancel(before)
        .catch((err) =>
          this.logger.warn(
            `Couldn't drop reminder ${before.id}'s job: ${String(err)}`,
          ),
        );
    }
  }

  private async find(
    userId: string,
    type: ReminderType,
  ): Promise<Reminder | undefined> {
    return (await this.reminders.findByUserId(userId)).find(
      (r) => r.type === type,
    );
  }

  private async waitingForLocation(userId: string): Promise<boolean> {
    return (await this.locations.findByUserId(userId)) === null;
  }

  private withStatus(reminder: Reminder, waiting: boolean): ReminderStatus {
    return { ...reminder, waitingForLocation: waiting };
  }
}
