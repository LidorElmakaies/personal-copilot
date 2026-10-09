import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';
import { AUTH_SERVICE } from '../../tokens';
import type {
  AuthTokens,
  IAuthService,
} from '../../application/interfaces/auth-service.interface';
import { DeleteAccountDto } from '../dto/delete-account.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';

// Every token response, and nothing else — see docs/specs/services.md#users.
const toTokenResponse = (tokens: AuthTokens) => ({
  access_token: tokens.accessToken,
  refresh_token: tokens.refreshToken,
});

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const tokens = await this.authService.register({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    });
    return toTokenResponse(tokens);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login({
      email: dto.email,
      password: dto.password,
    });
    return toTokenResponse(tokens);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refresh(dto.refresh_token);
    return toTokenResponse(tokens);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refresh_token);
  }

  @Post('account')
  @HttpCode(200)
  async updateAccount(@Body() dto: UpdateAccountDto) {
    const tokens = await this.authService.updateAccount({
      email: dto.email,
      currentPassword: dto.currentPassword,
      newEmail: dto.newEmail,
      newPassword: dto.newPassword,
    });
    return toTokenResponse(tokens);
  }

  @Delete('account')
  @HttpCode(204)
  async deleteAccount(@Body() dto: DeleteAccountDto): Promise<void> {
    await this.authService.deleteAccount({
      email: dto.email,
      currentPassword: dto.currentPassword,
    });
  }
}
