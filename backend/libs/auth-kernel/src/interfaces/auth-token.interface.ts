import type { UserRole } from './jwt-service.interface';

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
}

/** Implemented by AuthTokenService, consumed by Gateway's HTTP guard and WS handshake. */
export interface IAuthTokenService {
  /** Returns the decoded identity, or null if the token is missing/invalid/expired. */
  verify(token: string | null | undefined): Promise<AuthTokenPayload | null>;
}
