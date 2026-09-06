// Single role for now — this project has no admin/multi-role concept yet. If one gets added
// later, this is where it grows (see ask-my-crawl's @app/auth-kernel for the shape that takes).
export type UserRole = 'user';

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
