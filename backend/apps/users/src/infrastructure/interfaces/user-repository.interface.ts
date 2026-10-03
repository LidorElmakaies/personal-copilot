import type { UserRole } from '@app/auth-kernel';
import type { ProfileDetails } from '../../models/profile';
import type { User } from '../../models/user';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
}

/** Implemented by TypeOrmUserRepository, consumed by AuthService and AdminSeedService. */
export interface IUserRepository {
  /** Creates the user and their profile, and publishes the profile's state — atomically. */
  create(input: CreateUserInput, details: ProfileDetails): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updatePassword(
    userId: string,
    passwordHash: string,
    passwordSalt: string,
  ): Promise<void>;
  updateEmail(userId: string, email: string): Promise<void>;
  /** Deletes the user, their profile and refresh tokens, and publishes the deletion — atomically. */
  delete(userId: string): Promise<void>;
}
