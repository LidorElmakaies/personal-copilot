import type { UserRole } from '@app/auth-kernel';
import type { User } from '../../models/user';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
}

/** Implemented by TypeOrmUserRepository, consumed by AuthService. */
export interface IUserRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}
