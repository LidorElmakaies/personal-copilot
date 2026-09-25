import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { JWT_SERVICE, type IJwtService, type UserRole } from '@app/auth-kernel';
import {
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from '../tokens';
import type { IPasswordHasher } from '../infrastructure/interfaces/password-hasher.interface';
import type { IRefreshTokenRepository } from '../infrastructure/interfaces/refresh-token-repository.interface';
import type { IUserRepository } from '../infrastructure/interfaces/user-repository.interface';
import type { User } from '../models/user';
import type {
  AuthTokens,
  IAuthService,
  LoginInput,
  RegisterInput,
  UpdateAccountInput,
} from './interfaces/auth-service.interface';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(JWT_SERVICE) private readonly jwt: IJwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthTokens> {
    const email = input.email.toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const { hash, salt } = this.hasher.hash(input.password);
    const user = await this.users.create({
      email,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'user',
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.verifyCredentials(input.email, input.password);
    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.refreshTokens.findByTokenHash(
      this.hashRefreshToken(refreshToken),
    );

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: the used token is revoked no matter what happens next, so a stolen-and-replayed
    // refresh token only ever works once.
    await this.refreshTokens.revoke(stored.id);
    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByTokenHash(
      this.hashRefreshToken(refreshToken),
    );
    if (stored) {
      await this.refreshTokens.revoke(stored.id);
    }
  }

  async updateAccount(input: UpdateAccountInput): Promise<AuthTokens> {
    if (!input.newEmail && !input.newPassword) {
      throw new BadRequestException(
        'At least one of newEmail or newPassword is required',
      );
    }

    const user = await this.verifyCredentials(
      input.email,
      input.currentPassword,
    );

    let finalEmail = user.email;
    if (input.newEmail) {
      const newEmail = input.newEmail.toLowerCase();
      const existing = await this.users.findByEmail(newEmail);
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Email is already registered');
      }
      await this.users.updateEmail(user.id, newEmail);
      finalEmail = newEmail;
    }

    if (input.newPassword) {
      const { hash, salt } = this.hasher.hash(input.newPassword);
      await this.users.updatePassword(user.id, hash, salt);
      // Not revoking existing refresh tokens on password change — possible future hardening.
    }

    // Always reissue, even on a password-only change, so this endpoint has one response shape
    // rather than a conditional one depending on which field changed.
    return this.issueTokens(user.id, finalEmail, user.role);
  }

  private async verifyCredentials(
    email: string,
    password: string,
  ): Promise<User> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (
      !user ||
      !this.hasher.verify(password, user.passwordHash, user.passwordSalt)
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const accessToken = this.jwt.sign(
      { sub: userId, role, email },
      ACCESS_TOKEN_TTL,
    );

    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.refreshTokens.create(
      userId,
      this.hashRefreshToken(refreshToken),
      expiresAt,
    );

    return { accessToken, refreshToken };
  }

  // See docs/specs/services.md#auth for why a plain (unsalted) hash is fine here.
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
