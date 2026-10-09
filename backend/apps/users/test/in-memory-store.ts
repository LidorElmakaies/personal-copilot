import { randomUUID } from 'crypto';
import { KAFKA_TOPICS } from '@app/kafka-contracts';
import type { IProfileRepository } from '../src/infrastructure/interfaces/profile-repository.interface';
import type { IRefreshTokenRepository } from '../src/infrastructure/interfaces/refresh-token-repository.interface';
import {
  EmailTakenError,
  type CreateUserInput,
  type IUserRepository,
} from '../src/infrastructure/interfaces/user-repository.interface';
import { toUserStateMessage } from '../src/infrastructure/postgres/user-events';
import type {
  Profile,
  ProfileChange,
  ProfileDetails,
} from '../src/models/profile';
import type { RefreshToken } from '../src/models/refresh-token';
import type { User } from '../src/models/user';

export interface RecordedEvent {
  topic: string;
  key: string;
  payload: object | null;
}

/** Same semantics as the TypeORM repositories, events recorded instead of written to an outbox. */
export class InMemoryStore {
  readonly users = new Map<string, User>();
  readonly profiles = new Map<string, Profile>();
  readonly refreshTokens = new Map<string, RefreshToken>();
  readonly events: RecordedEvent[] = [];

  readonly userRepository: IUserRepository = {
    create: (input: CreateUserInput, details: ProfileDetails) => {
      if (this.emailTaken(input.email)) {
        return Promise.reject(new EmailTakenError());
      }
      const now = new Date();
      const user: User = {
        id: randomUUID(),
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(user.id, user);
      this.saveProfile({
        userId: user.id,
        ...details,
        location: null,
        version: 1,
      });
      return Promise.resolve(user);
    },
    findById: (id) => Promise.resolve(this.users.get(id) ?? null),
    findByEmail: (email) =>
      Promise.resolve(
        [...this.users.values()].find((u) => u.email === email) ?? null,
      ),
    updateCredentials: (userId, change) => {
      if (change.email && this.emailTaken(change.email, userId)) {
        return Promise.reject(new EmailTakenError());
      }
      Object.assign(this.users.get(userId)!, change);
      if (change.passwordHash) {
        for (const token of this.refreshTokens.values())
          if (token.userId === userId) token.revokedAt ??= new Date();
      }
      return Promise.resolve();
    },
    delete: (userId) => {
      if (this.users.delete(userId)) {
        this.profiles.delete(userId);
        for (const [id, token] of this.refreshTokens)
          if (token.userId === userId) this.refreshTokens.delete(id);
        this.events.push({
          topic: KAFKA_TOPICS.USER_STATE,
          key: userId,
          payload: null,
        });
      }
      return Promise.resolve();
    },
  };

  readonly profileRepository: IProfileRepository = {
    findByUserId: (userId) =>
      Promise.resolve(this.profiles.get(userId) ?? null),
    update: (userId, change: ProfileChange) => {
      const current = this.profiles.get(userId);
      if (!current) return Promise.resolve(null);
      const next: Profile = {
        ...current,
        ...Object.fromEntries(
          Object.entries(change).filter(([, v]) => v !== undefined),
        ),
        version: current.version + 1,
      };
      this.saveProfile(next);
      return Promise.resolve(next);
    },
  };

  readonly refreshTokenRepository: IRefreshTokenRepository = {
    create: (userId, tokenHash, expiresAt) => {
      const token: RefreshToken = {
        id: randomUUID(),
        userId,
        tokenHash,
        expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };
      this.refreshTokens.set(token.id, token);
      return Promise.resolve(token);
    },
    findByTokenHash: (tokenHash) =>
      Promise.resolve(
        [...this.refreshTokens.values()].find(
          (t) => t.tokenHash === tokenHash,
        ) ?? null,
      ),
    revoke: (id) => {
      this.refreshTokens.get(id)!.revokedAt = new Date();
      return Promise.resolve();
    },
  };

  private emailTaken(email: string, exceptUserId?: string): boolean {
    return [...this.users.values()].some(
      (u) => u.email === email && u.id !== exceptUserId,
    );
  }

  stateEventsFor(userId: string) {
    return this.events
      .filter((e) => e.topic === KAFKA_TOPICS.USER_STATE && e.key === userId)
      .map((e) => e.payload);
  }

  private saveProfile(profile: Profile): void {
    this.profiles.set(profile.userId, profile);
    this.events.push({
      topic: KAFKA_TOPICS.USER_STATE,
      key: profile.userId,
      payload: toUserStateMessage(profile),
    });
  }
}
