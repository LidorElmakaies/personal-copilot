// DI tokens for the Users Service app; JWT_SERVICE comes from @app/auth-kernel.
export const AUTH_SERVICE = Symbol('IAuthService');
export const PROFILE_SERVICE = Symbol('IProfileService');
export const USER_REPOSITORY = Symbol('IUserRepository');
export const PROFILE_REPOSITORY = Symbol('IProfileRepository');
export const REFRESH_TOKEN_REPOSITORY = Symbol('IRefreshTokenRepository');
export const PASSWORD_HASHER = Symbol('IPasswordHasher');
export const EVENT_PUBLISHER = Symbol('IEventPublisher');
export const OUTBOX_RELAY = Symbol('OutboxRelay');
