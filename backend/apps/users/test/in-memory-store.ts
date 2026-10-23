import { randomUUID } from 'crypto';
import type { IProfileRepository } from '../src/infrastructure/interfaces/profile-repository.interface';
import type { IRefreshTokenRepository } from '../src/infrastructure/interfaces/refresh-token-repository.interface';
import {
  EmailTakenError,
  type CreateUserInput,
  type IUserRepository,
} from '../src/infrastructure/interfaces/user-repository.interface';
import type {
  Profile,
  ProfileChange,
  ProfileDetails,
} from '../src/models/profile';
import type { RefreshToken } from '../src/models/refresh-token';
import type { User } from '../src/models/user';

/** Same semantics as the TypeORM repositories. */
export class InMemoryStore {
  readonly users = new Map<string, User>();
  readonly profiles = new Map<string, Profile>();
  readonly refreshTokens = new Map<string, RefreshToken>();

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
      this.profiles.set(user.id, {
        userId: user.id,
        ...details,
        location: null,
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
      };
      this.profiles.set(userId, next);
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
      const token = this.refreshTokens.get(id);
      if (!token || token.revokedAt) return Promise.resolve(false);
      token.revokedAt = new Date();
      return Promise.resolve(true);
    },
  };

  private emailTaken(email: string, exceptUserId?: string): boolean {
    return [...this.users.values()].some(
      (u) => u.email === email && u.id !== exceptUserId,
    );
  }
}
