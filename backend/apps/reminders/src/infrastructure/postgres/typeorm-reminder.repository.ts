import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  Reminder,
  ReminderSettings,
  ReminderType,
} from '../../models/reminder';
import type { IReminderRepository } from '../interfaces/reminder-repository.interface';
import { ReminderEntity } from '../../entities/reminder.entity';

const toModel = (r: ReminderEntity): Reminder => ({
  id: r.id,
  userId: r.userId,
  type: r.type,
  offsetMinutes: r.offsetMinutes,
  lat: r.lat,
  lon: r.lon,
  tz: r.tz,
  enabled: r.enabled,
  nextFireAt: r.nextFireAt,
});

@Injectable()
export class TypeOrmReminderRepository implements IReminderRepository {
  constructor(
    @InjectRepository(ReminderEntity)
    private readonly repo: Repository<ReminderEntity>,
  ) {}

  async findByUserId(userId: string): Promise<Reminder[]> {
    return (await this.repo.findBy({ userId })).map(toModel);
  }

  async upsertEnabled(
    userId: string,
    type: ReminderType,
    settings: ReminderSettings,
  ): Promise<Reminder> {
    await this.repo.upsert(
      { userId, type, ...settings, enabled: true, nextFireAt: null },
      ['userId', 'type'],
    );
    return toModel(await this.repo.findOneByOrFail({ userId, type }));
  }

  async disable(userId: string, type: ReminderType): Promise<void> {
    await this.repo.update(
      { userId, type },
      { enabled: false, nextFireAt: null },
    );
  }
}
