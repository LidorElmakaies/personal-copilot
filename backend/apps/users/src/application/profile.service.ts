import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PROFILE_REPOSITORY, USER_REPOSITORY } from '../tokens';
import type { IProfileRepository } from '../infrastructure/interfaces/profile-repository.interface';
import type { IUserRepository } from '../infrastructure/interfaces/user-repository.interface';
import { EMPTY_PROFILE_DETAILS, type Profile } from '../models/profile';
import type {
  IProfileService,
  ProfileUpdate,
} from './interfaces/profile-service.interface';

@Injectable()
export class ProfileService implements IProfileService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: IProfileRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  async get(userId: string): Promise<Profile> {
    const profile = await this.profiles.findByUserId(userId);
    if (profile) return profile;
    if (!(await this.users.findById(userId))) {
      throw new NotFoundException('Account not found');
    }
    return { userId, ...EMPTY_PROFILE_DETAILS, location: null, version: 0 };
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
