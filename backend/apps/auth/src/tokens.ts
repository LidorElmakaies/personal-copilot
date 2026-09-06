// DI injection tokens for the Auth Service app. AUTH_TOKEN_SERVICE/JWT_SERVICE live in
// @app/auth-kernel (shared across apps) — not redeclared here.
export const AUTH_SERVICE = Symbol('IAuthService');
export const USER_REPOSITORY = Symbol('IUserRepository');
export const REFRESH_TOKEN_REPOSITORY = Symbol('IRefreshTokenRepository');
export const PASSWORD_HASHER = Symbol('IPasswordHasher');
