import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PROFILE_REPOSITORY } from '../tokens';
import type { IProfileRepository } from '../infrastructure/interfaces/profile-repository.interface';
import type { Profile } from '../models/profile';
import type {
  IProfileService,
  ProfileUpdate,
} from './interfaces/profile-service.interface';

@Injectable()
export class ProfileService implements IProfileService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: IProfileRepository,
  ) {}

  async get(userId: string): Promise<Profile> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new NotFoundException('Account not found');
    return profile;
  }

  async update(userId: string, change: ProfileUpdate): Promise<Profile> {
    if (Object.values(change).every((v) => v === undefined)) {
      throw new BadRequestException('Nothing to update');
    }
    const { location, ...details } = change;
    const profile = await this.profiles.update(userId, {
      ...details,
      ...(location && { location: { ...location, updatedAt: new Date() } }),
    });
    if (!profile) throw new NotFoundException('Account not found');
    return profile;
  }
}
