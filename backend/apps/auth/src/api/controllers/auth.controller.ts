import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { AUTH_SERVICE } from '../../tokens';
import type { IAuthService } from '../../application/interfaces/auth-service.interface';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';

// No `user` object in any response — see docs/specs/services.md#auth.
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
    });
    return { access_token: tokens.accessToken, refresh_token: tokens.refreshToken };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login({
      email: dto.email,
      password: dto.password,
    });
    return { access_token: tokens.accessToken, refresh_token: tokens.refreshToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refresh(dto.refresh_token);
    return { access_token: tokens.accessToken, refresh_token: tokens.refreshToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refresh_token);
  }
}
