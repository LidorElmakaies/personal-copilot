import type { RefreshToken } from '../../models/refresh-token';

/** Implemented by TypeOrmRefreshTokenRepository, consumed by AuthService. */
export interface IRefreshTokenRepository {
  create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  /** True only for the call that revoked it: of two at once, one gets false. */
  revoke(id: string): Promise<boolean>;
}
