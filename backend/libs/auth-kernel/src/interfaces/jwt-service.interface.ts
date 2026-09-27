// Extend this union to add a role — the JWT payload and the `users.role` column (plain `text`, no
// enum constraint) both follow from this one type, so no schema change is needed to grow the set.
export type UserRole = 'user' | 'admin';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  // No /me lookup — the client decodes this directly. See docs/specs/services.md#auth.
  email: string;
}

/** Implemented by JsonWebTokenService, consumed wherever a service needs to sign/verify access tokens. */
export interface IJwtService {
  sign(payload: JwtPayload, expiresIn: string): string;
  verify(token: string): JwtPayload | null;
}
