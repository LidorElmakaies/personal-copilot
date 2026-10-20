import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isoDate, type IReminderOccurrences } from '@app/jewish-calendar';
import {
  CUSTOM_REMINDER_REPOSITORY,
  CUSTOM_REMINDER_SCHEDULER,
  REMINDER_OCCURRENCES,
} from '../tokens';
import {
  civilDate,
  ruleOf,
  type CustomReminder,
  type CustomReminderInput,
  type CustomReminderInRange,
} from '../models/custom-reminder';
import type { ICustomReminderRepository } from '../infrastructure/interfaces/custom-reminder-repository.interface';
import type { ICustomReminderScheduler } from './interfaces/custom-reminder-scheduler.interface';
import type { ICustomReminderService } from './interfaces/custom-reminder-service.interface';

/** Enough for a calendar month and two either side, with room to spare. */
export const MAX_RANGE_DAYS = 400;
export const MAX_REMINDERS_PER_USER = 200;
export const MAX_SKIPPED_DATES = 500;

@Injectable()
export class CustomReminderService implements ICustomReminderService {
  private readonly logger = new Logger(CustomReminderService.name);

  constructor(
    @Inject(CUSTOM_REMINDER_REPOSITORY)
    private readonly reminders: ICustomReminderRepository,
    @Inject(REMINDER_OCCURRENCES)
    private readonly occurrences: IReminderOccurrences,
    @Inject(CUSTOM_REMINDER_SCHEDULER)
    private readonly scheduler: ICustomReminderScheduler,
  ) {}

  async list(
    userId: string,
    from: string,
    to: string,
  ): Promise<CustomReminderInRange[]> {
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (days < 0) throw new BadRequestException('from must not be after to');
    if (days >= MAX_RANGE_DAYS)
      throw new BadRequestException(`At most ${MAX_RANGE_DAYS} days at once`);
    return (await this.reminders.findByUserId(userId)).map((r) => ({
      ...r,
      dates: this.occurrences
        .datesBetween(ruleOf(r), civilDate(from), civilDate(to))
        .map(isoDate),
    }));
  }

  async create(
    userId: string,
    input: CustomReminderInput,
  ): Promise<CustomReminder> {
    if ((await this.reminders.countByUserId(userId)) >= MAX_REMINDERS_PER_USER)
      throw new UnprocessableEntityException(
        `At most ${MAX_REMINDERS_PER_USER} reminders`,
      );
    return this.schedule(await this.reminders.create(userId, input));
  }

  async update(
    userId: string,
    id: string,
    patch: Partial<CustomReminderInput>,
  ): Promise<CustomReminder> {
    if (Object.keys(patch).length === 0)
      throw new BadRequestException('Nothing to update');
    return this.schedule(
      (await this.reminders.update(userId, id, patch)) ?? this.notFound(),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    const before = await this.reminders.findOwned(userId, id);
    if (!before || !(await this.reminders.delete(userId, id))) this.notFound();
    // Best-effort tidy-up: a leftover job finds the reminder gone and does nothing.
    await this.scheduler
      .cancel(before)
      .catch((err) =>
        this.logger.warn(
          `Couldn't drop custom reminder ${id}'s job: ${String(err)}`,
        ),
      );
  }

  async skip(
    userId: string,
    id: string,
    date: string,
  ): Promise<CustomReminder> {
    const reminder =
      (await this.reminders.findOwned(userId, id)) ?? this.notFound();
    if (reminder.skipped.includes(date)) return reminder;
    if (reminder.skipped.length >= MAX_SKIPPED_DATES)
      throw new UnprocessableEntityException(
        `At most ${MAX_SKIPPED_DATES} skipped days`,
      );
    if (!this.occurrences.fallsOn(ruleOf(reminder, false), civilDate(date)))
      throw new UnprocessableEntityException(
        `This reminder doesn't fall on ${date}`,
      );
    return this.schedule(
      (await this.reminders.update(userId, id, {
        skipped: [...reminder.skipped, date].sort(),
      })) ?? this.notFound(),
    );
  }

  /** The change is saved either way; a Redis failure here is fixed by the next sweep. */
  private async schedule(reminder: CustomReminder): Promise<CustomReminder> {
    try {
      return await this.scheduler.schedule(reminder);
    } catch (err) {
      this.logger.warn(
        `Couldn't schedule custom reminder ${reminder.id}: ${String(err)}`,
      );
      return reminder;
    }
  }

  private notFound(): never {
    throw new NotFoundException('Reminder not found');
  }
}
