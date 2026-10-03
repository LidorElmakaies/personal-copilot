import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OutboxRelay } from '@app/kafka-client';
import { OUTBOX_RELAY } from '../../tokens';
import type { Profile, ProfileChange } from '../../models/profile';
import type { IProfileRepository } from '../interfaces/profile-repository.interface';
import { ProfileEntity } from '../../entities/profile.entity';
import { UserEntity } from '../../entities/user.entity';
import { addUserStateEvent } from './user-events';

export function toProfile(p: ProfileEntity): Profile {
  return {
    userId: p.userId,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    location:
      p.lat !== null &&
      p.lon !== null &&
      p.tz !== null &&
      p.locationUpdatedAt !== null
        ? { lat: p.lat, lon: p.lon, tz: p.tz, updatedAt: p.locationUpdatedAt }
        : null,
    version: p.version,
  };
}

@Injectable()
export class TypeOrmProfileRepository implements IProfileRepository {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly repo: Repository<ProfileEntity>,
    @Inject(OUTBOX_RELAY) private readonly relay: OutboxRelay,
  ) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    const row = await this.repo.findOneBy({ userId });
    return row ? toProfile(row) : null;
  }

  async update(userId: string, change: ProfileChange): Promise<Profile | null> {
    const saved = await this.repo.manager.transaction(async (m) => {
      // Share-locks the user so a concurrent account delete can't slip in between.
      const user = await m.findOne(UserEntity, {
        where: { id: userId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!user) return null;

      await m
        .createQueryBuilder()
        .insert()
        .into(ProfileEntity)
        .values({ userId, version: 0 })
        .orIgnore()
        .execute();
      const profile = await m.findOneOrFail(ProfileEntity, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (change.firstName !== undefined) profile.firstName = change.firstName;
      if (change.lastName !== undefined) profile.lastName = change.lastName;
      if (change.phone !== undefined) profile.phone = change.phone;
      if (change.location) {
        profile.lat = change.location.lat;
        profile.lon = change.location.lon;
        profile.tz = change.location.tz;
        profile.locationUpdatedAt = change.location.updatedAt;
      }
      profile.version += 1;

      const result = toProfile(await m.save(profile));
      await addUserStateEvent(m, result);
      return result;
    });

    if (saved) this.relay.notify();
    return saved;
  }
}
