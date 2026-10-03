import type { ProfileDetails } from '../../models/profile';

export interface RegisterInput extends Partial<ProfileDetails> {
  email: string;
  password: string;
}

export interface DeleteAccountInput {
  email: string;
  currentPassword: string;
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

/** Implemented by AuthService, consumed by AuthController. Returns tokens only — see docs/specs/services.md#users. */
export interface IAuthService {
  register(input: RegisterInput): Promise<AuthTokens>;
  login(input: LoginInput): Promise<AuthTokens>;
  /** Rotates the refresh token — the old one is revoked, a new pair is issued. */
  refresh(refreshToken: string): Promise<AuthTokens>;
  logout(refreshToken: string): Promise<void>;
  /** Body-driven, not JwtAuthGuard-based — currentPassword is the proof of identity. */
  updateAccount(input: UpdateAccountInput): Promise<AuthTokens>;
  /** Immediate and permanent; other services' rows about the user cascade with it. */
  deleteAccount(input: DeleteAccountInput): Promise<void>;
}
