export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateAccountInput {
  email: string;
  currentPassword: string;
  newEmail?: string;
  newPassword?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Implemented by AuthService, consumed by AuthController. Returns tokens only — see docs/specs/services.md#auth. */
export interface IAuthService {
  register(input: RegisterInput): Promise<AuthTokens>;
  login(input: LoginInput): Promise<AuthTokens>;
  /** Rotates the refresh token — the old one is revoked, a new pair is issued. */
  refresh(refreshToken: string): Promise<AuthTokens>;
  logout(refreshToken: string): Promise<void>;
  /** Body-driven, not JwtAuthGuard-based — currentPassword is the proof of identity. */
  updateAccount(input: UpdateAccountInput): Promise<AuthTokens>;
}
