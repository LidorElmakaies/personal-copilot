import { Inject, Injectable } from '@nestjs/common';
import { REMINDER_REPOSITORY, USER_LOCATION_READER } from '../tokens';
import type {
  Reminder,
  ReminderSettings,
  ReminderStatus,
  ReminderType,
} from '../models/reminder';
import type { IReminderRepository } from '../infrastructure/interfaces/reminder-repository.interface';
import type { IUserLocationReader } from '../infrastructure/interfaces/user-location-reader.interface';
import type { IReminderService } from './interfaces/reminder-service.interface';

@Injectable()
export class ReminderService implements IReminderService {
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminders: IReminderRepository,
    @Inject(USER_LOCATION_READER)
    private readonly locations: IUserLocationReader,
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
    const [reminder, waiting] = await Promise.all([
      this.reminders.upsertEnabled(userId, type, settings),
      this.waitingForLocation(userId),
    ]);
    return this.withStatus(reminder, waiting);
  }

  turnOff(userId: string, type: ReminderType): Promise<void> {
    return this.reminders.disable(userId, type);
  }

  private async waitingForLocation(userId: string): Promise<boolean> {
    return (await this.locations.findByUserId(userId)) === null;
  }

  private withStatus(reminder: Reminder, waiting: boolean): ReminderStatus {
    return { ...reminder, waitingForLocation: waiting };
  }
}
