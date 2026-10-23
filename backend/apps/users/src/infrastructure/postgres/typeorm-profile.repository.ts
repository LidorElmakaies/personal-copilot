import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Profile, ProfileChange } from '../../models/profile';
import type { IProfileRepository } from '../interfaces/profile-repository.interface';
import { ProfileEntity } from '../../entities/profile.entity';

export function toProfile(p: ProfileEntity): Profile {
  return {
    userId: p.userId,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    location:
      p.lat !== null && p.lon !== null && p.locationUpdatedAt !== null
        ? { lat: p.lat, lon: p.lon, updatedAt: p.locationUpdatedAt }
        : null,
  };
}

@Injectable()
export class TypeOrmProfileRepository implements IProfileRepository {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly repo: Repository<ProfileEntity>,
  ) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    const row = await this.repo.findOneBy({ userId });
    return row ? toProfile(row) : null;
  }

  update(userId: string, change: ProfileChange): Promise<Profile | null> {
    return this.repo.manager.transaction(async (m) => {
      // An account delete removes this row first, so it waits for this write, or this finds nothing.
      const profile = await m.findOne(ProfileEntity, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!profile) return null;

      if (change.firstName !== undefined) profile.firstName = change.firstName;
      if (change.lastName !== undefined) profile.lastName = change.lastName;
      if (change.phone !== undefined) profile.phone = change.phone;
      if (change.location) {
        profile.lat = change.location.lat;
        profile.lon = change.location.lon;
        profile.locationUpdatedAt = change.location.updatedAt;
      }

      return toProfile(await m.save(profile));
    });
  }
}
