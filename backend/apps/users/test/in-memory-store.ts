import { randomUUID } from 'crypto';
import { KAFKA_TOPICS } from '@app/kafka-contracts';
import type { IProfileRepository } from '../src/infrastructure/interfaces/profile-repository.interface';
import type {
  CreateUserInput,
  IUserRepository,
} from '../src/infrastructure/interfaces/user-repository.interface';
import { toUserStateMessage } from '../src/infrastructure/postgres/user-events';
import type {
  Profile,
  ProfileChange,
  ProfileDetails,
} from '../src/models/profile';
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
  readonly events: RecordedEvent[] = [];

  readonly userRepository: IUserRepository = {
    create: (input: CreateUserInput, details: ProfileDetails) => {
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
    updatePassword: (userId, passwordHash, passwordSalt) => {
      Object.assign(this.users.get(userId)!, { passwordHash, passwordSalt });
      return Promise.resolve();
    },
    updateEmail: (userId, email) => {
      Object.assign(this.users.get(userId)!, { email });
      return Promise.resolve();
    },
    delete: (userId) => {
      if (this.users.delete(userId)) {
        this.profiles.delete(userId);
        this.events.push(
          {
            topic: KAFKA_TOPICS.USER_DELETED,
            key: userId,
            payload: { userId, deletedAt: new Date().toISOString() },
          },
          { topic: KAFKA_TOPICS.USER_STATE, key: userId, payload: null },
        );
      }
      return Promise.resolve();
    },
  };

  readonly profileRepository: IProfileRepository = {
    findByUserId: (userId) =>
      Promise.resolve(this.profiles.get(userId) ?? null),
    update: (userId, change: ProfileChange) => {
      if (!this.users.has(userId)) return Promise.resolve(null);
      const current = this.profiles.get(userId) ?? {
        userId,
        firstName: null,
        lastName: null,
        phone: null,
        location: null,
        version: 0,
      };
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

  /** Adds an account from before profiles existed: a user without a profile row. */
  addLegacyUser(email: string): User {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email,
      passwordHash: 'x',
      passwordSalt: 'x',
      role: 'user',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
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
