import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OutboxRelay } from '@app/kafka-client';
import { OUTBOX_RELAY } from '../../tokens';
import type { ProfileDetails } from '../../models/profile';
import type { User } from '../../models/user';
import type {
  CreateUserInput,
  IUserRepository,
} from '../interfaces/user-repository.interface';
import { ProfileEntity } from '../../entities/profile.entity';
import { RefreshTokenEntity } from '../../entities/refresh-token.entity';
import { UserEntity } from '../../entities/user.entity';
import { toProfile } from './typeorm-profile.repository';
import { addUserDeletedEvents, addUserStateEvent } from './user-events';

function toDomain(entity: UserEntity): User {
  return {
    id: entity.id,
    email: entity.email,
    passwordHash: entity.passwordHash,
    passwordSalt: entity.passwordSalt,
    role: entity.role,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
    @Inject(OUTBOX_RELAY) private readonly relay: OutboxRelay,
  ) {}

  async create(input: CreateUserInput, details: ProfileDetails): Promise<User> {
    const user = await this.repo.manager.transaction(async (m) => {
      const saved = await m.save(m.create(UserEntity, input));
      const profile = await m.save(
        m.create(ProfileEntity, {
          userId: saved.id,
          ...details,
          lat: null,
          lon: null,
          tz: null,
          locationUpdatedAt: null,
          version: 1,
        }),
      );
      await addUserStateEvent(m, toProfile(profile));
      return saved;
    });
    this.relay.notify();
    return toDomain(user);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repo.findOneBy({ email });
    return entity ? toDomain(entity) : null;
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    passwordSalt: string,
  ): Promise<void> {
    await this.repo.update({ id: userId }, { passwordHash, passwordSalt });
  }

  async updateEmail(userId: string, email: string): Promise<void> {
    await this.repo.update({ id: userId }, { email });
  }

  async delete(userId: string): Promise<void> {
    const deleted = await this.repo.manager.transaction(async (m) => {
      await m.delete(RefreshTokenEntity, { userId });
      await m.delete(ProfileEntity, { userId });
      const { affected } = await m.delete(UserEntity, { id: userId });
      if (!affected) return false;
      await addUserDeletedEvents(m, userId, new Date());
      return true;
    });
    if (deleted) this.relay.notify();
  }
}
