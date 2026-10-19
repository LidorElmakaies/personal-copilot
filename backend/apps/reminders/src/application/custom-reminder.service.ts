import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  isoDate,
  type CivilDate,
  type IReminderOccurrences,
  type ReminderRule,
} from '@app/jewish-calendar';
import { CUSTOM_REMINDER_REPOSITORY, REMINDER_OCCURRENCES } from '../tokens';
import type {
  CustomReminder,
  CustomReminderInput,
  CustomReminderInRange,
} from '../models/custom-reminder';
import type { ICustomReminderRepository } from '../infrastructure/interfaces/custom-reminder-repository.interface';
import type { ICustomReminderService } from './interfaces/custom-reminder-service.interface';

/** Enough for a calendar month and two either side, with room to spare. */
export const MAX_RANGE_DAYS = 400;
export const MAX_REMINDERS_PER_USER = 200;
export const MAX_SKIPPED_DATES = 500;

const civil = (s: string): CivilDate => {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
};
const ruleOf = (r: CustomReminder, withSkips = true): ReminderRule => ({
  start: civil(r.start),
  hour: r.hour,
  minute: r.minute,
  repeat: r.repeat,
  calendar: r.calendar,
  skipped: withSkips ? r.skipped.map(civil) : [],
});

@Injectable()
export class CustomReminderService implements ICustomReminderService {
  constructor(
    @Inject(CUSTOM_REMINDER_REPOSITORY)
    private readonly reminders: ICustomReminderRepository,
    @Inject(REMINDER_OCCURRENCES)
    private readonly occurrences: IReminderOccurrences,
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
        .datesBetween(ruleOf(r), civil(from), civil(to))
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
    return this.reminders.create(userId, input);
  }

  async update(
    userId: string,
    id: string,
    patch: Partial<CustomReminderInput>,
  ): Promise<CustomReminder> {
    if (Object.keys(patch).length === 0)
      throw new BadRequestException('Nothing to update');
    return (await this.reminders.update(userId, id, patch)) ?? this.notFound();
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.reminders.delete(userId, id))) this.notFound();
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
    if (!this.occurrences.fallsOn(ruleOf(reminder, false), civil(date)))
      throw new UnprocessableEntityException(
        `This reminder doesn't fall on ${date}`,
      );
    return (
      (await this.reminders.update(userId, id, {
        skipped: [...reminder.skipped, date].sort(),
      })) ?? this.notFound()
    );
  }

  private notFound(): never {
    throw new NotFoundException('Reminder not found');
  }
}
