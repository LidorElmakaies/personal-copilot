import type { UserRole } from '@app/auth-kernel';
import type { ProfileDetails } from '../../models/profile';
import type { User } from '../../models/user';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
}

/** Only the fields present change. */
export interface CredentialsChange {
  email?: string;
  passwordHash?: string;
  passwordSalt?: string;
}

/** Thrown by create/updateCredentials when another account has the email. */
export class EmailTakenError extends Error {
  constructor() {
    super('Email is already registered');
    this.name = 'EmailTakenError';
  }
}

/** Implemented by TypeOrmUserRepository, consumed by AuthService and AdminSeedService. */
export interface IUserRepository {
  /** Creates the user and their profile, and publishes the profile's state — atomically. Throws EmailTakenError. */
  create(input: CreateUserInput, details: ProfileDetails): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /**
   * One transaction: an email and a password change land together or not at all, and a new
   * password revokes every refresh token the user has. Throws EmailTakenError.
   */
  updateCredentials(userId: string, change: CredentialsChange): Promise<void>;
  /** Deletes the user (cascading to other services' rows about them) and publishes a tombstone — atomically. */
  delete(userId: string): Promise<void>;
}
