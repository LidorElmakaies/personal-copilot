// Domain layer — pure data shape, not to be confused with an `I<Thing>` interface. No
// PublicUser/toPublicUser here: nothing ever hands a User back over HTTP, see docs/specs/services.md#auth.
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
