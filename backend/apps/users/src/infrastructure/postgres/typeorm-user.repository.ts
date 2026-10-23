import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import type { ProfileDetails } from '../../models/profile';
import type { User } from '../../models/user';
import {
  EmailTakenError,
  type CreateUserInput,
  type CredentialsChange,
  type IUserRepository,
} from '../interfaces/user-repository.interface';
import { ProfileEntity } from '../../entities/profile.entity';
import { RefreshTokenEntity } from '../../entities/refresh-token.entity';
import { UserEntity } from '../../entities/user.entity';

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

// users.email is the only unique column a write can collide on, so the database is the one check
// (a lookup first would race with a concurrent register).
async function emailTakenOnConflict<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (err) {
    if (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string }).code === '23505'
    ) {
      throw new EmailTakenError();
    }
    throw err;
  }
}

@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
  ) {}

  async create(input: CreateUserInput, details: ProfileDetails): Promise<User> {
    const user = await emailTakenOnConflict(
      this.repo.manager.transaction(async (m) => {
        const saved = await m.save(m.create(UserEntity, input));
        await m.save(
          m.create(ProfileEntity, {
            userId: saved.id,
            ...details,
            lat: null,
            lon: null,
            locationUpdatedAt: null,
          }),
        );
        return saved;
      }),
    );
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

  async updateCredentials(
    userId: string,
    change: CredentialsChange,
  ): Promise<void> {
    await emailTakenOnConflict(
      this.repo.manager.transaction(async (m) => {
        await m.update(UserEntity, { id: userId }, change);
        if (change.passwordHash) {
          await m.update(
            RefreshTokenEntity,
            { userId, revokedAt: IsNull() },
            { revokedAt: new Date() },
          );
        }
      }),
    );
  }

  async delete(userId: string): Promise<void> {
    await this.repo.manager.transaction(async (m) => {
      await m.delete(RefreshTokenEntity, { userId });
      await m.delete(ProfileEntity, { userId });
      await m.delete(UserEntity, { id: userId });
    });
  }
}
