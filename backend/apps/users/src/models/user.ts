import type { UserRole } from '@app/auth-kernel';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}
