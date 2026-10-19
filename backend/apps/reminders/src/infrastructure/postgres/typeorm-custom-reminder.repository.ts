import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CustomReminder,
  CustomReminderInput,
} from '../../models/custom-reminder';
import type { ICustomReminderRepository } from '../interfaces/custom-reminder-repository.interface';
import { CustomReminderEntity } from '../../entities/custom-reminder.entity';

const toModel = (r: CustomReminderEntity): CustomReminder => ({
  id: r.id,
  userId: r.userId,
  title: r.title,
  hour: r.hour,
  minute: r.minute,
  repeat: r.repeat,
  calendar: r.calendar,
  start: r.start,
  skipped: [...r.skipped].sort(),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

@Injectable()
export class TypeOrmCustomReminderRepository implements ICustomReminderRepository {
  constructor(
    @InjectRepository(CustomReminderEntity)
    private readonly repo: Repository<CustomReminderEntity>,
  ) {}

  async findByUserId(userId: string): Promise<CustomReminder[]> {
    return (
      await this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } })
    ).map(toModel);
  }

  async findOwned(userId: string, id: string): Promise<CustomReminder | null> {
    const row = await this.repo.findOneBy({ id, userId });
    return row ? toModel(row) : null;
  }

  countByUserId(userId: string): Promise<number> {
    return this.repo.countBy({ userId });
  }

  async create(
    userId: string,
    input: CustomReminderInput,
  ): Promise<CustomReminder> {
    return toModel(
      await this.repo.save(this.repo.create({ ...input, userId, skipped: [] })),
    );
  }

  async update(
    userId: string,
    id: string,
    patch: Partial<CustomReminderInput> & { skipped?: string[] },
  ): Promise<CustomReminder | null> {
    const row = await this.repo.findOneBy({ id, userId });
    if (!row) return null;
    return toModel(await this.repo.save(Object.assign(row, patch)));
  }

  async delete(userId: string, id: string): Promise<boolean> {
    return ((await this.repo.delete({ id, userId })).affected ?? 0) > 0;
  }
}
