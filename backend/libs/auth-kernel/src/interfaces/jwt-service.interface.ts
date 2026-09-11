// Extend this union to add a role (e.g. 'guest') — the JWT payload, the `users.role` DB column
// (plain `text`, no enum constraint), and every switch/guard over UserRole all follow from this
// one type, so nothing else needs a schema change to grow the set.
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
