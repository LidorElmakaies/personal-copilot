import { Inject, Injectable } from '@nestjs/common';
import { REMINDER_REPOSITORY } from '../tokens';
import type {
  Reminder,
  ReminderSettings,
  ReminderType,
} from '../models/reminder';
import type { IReminderRepository } from '../infrastructure/interfaces/reminder-repository.interface';
import type { IReminderService } from './interfaces/reminder-service.interface';

@Injectable()
export class ReminderService implements IReminderService {
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminders: IReminderRepository,
  ) {}

  list(userId: string): Promise<Reminder[]> {
    return this.reminders.findByUserId(userId);
  }

  save(
    userId: string,
    type: ReminderType,
    settings: ReminderSettings,
  ): Promise<Reminder> {
    return this.reminders.upsertEnabled(userId, type, settings);
  }

  turnOff(userId: string, type: ReminderType): Promise<void> {
    return this.reminders.disable(userId, type);
  }
}
