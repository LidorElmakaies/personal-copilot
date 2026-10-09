// Extend this list to add a role — the JWT payload, token verification and the `users.role` column
// (plain `text`, no enum constraint) all follow from it, so no schema change is needed to grow the set.
export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface JwtPayload {
  sub: string;
  role: UserRole;
  // No /me lookup — the client decodes this directly. See docs/specs/services.md#users.
  email: string;
}

/** Implemented by JsonWebTokenService, consumed wherever a service needs to sign/verify access tokens. */
export interface IJwtService {
  sign(payload: JwtPayload, expiresIn: string): string;
  verify(token: string): JwtPayload | null;
  /** A device token: `{ sub: deviceId, typ: 'device' }`, no expiry — never a user's access token. */
  signDevice(deviceId: string): string;
  /** The device id, or null unless it's a valid device token. */
  verifyDevice(token: string): string | null;
}
