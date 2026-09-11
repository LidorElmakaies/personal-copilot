import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AUTH_PROXY_SERVICE } from '../../tokens';
import { authStrictThrottlePolicy } from '../../throttle-policies';
import type { IAuthProxyService } from '../application/interfaces/auth-proxy-service.interface';
import { writeProxyResponse } from './write-proxy-response';

// Pure passthrough to Auth Service — no domain decisions here.
@Controller('auth')
export class AuthProxyController {
  constructor(
    @Inject(AUTH_PROXY_SERVICE) private readonly proxy: IAuthProxyService,
  ) {}

  @Throttle(authStrictThrottlePolicy)
  @Post('register')
  async register(@Body() body: unknown, @Res() res: Response): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'POST',
        path: '/auth/register',
        body,
      }),
    );
  }

  @Throttle(authStrictThrottlePolicy)
  @Post('login')
  async login(@Body() body: unknown, @Res() res: Response): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({ method: 'POST', path: '/auth/login', body }),
    );
  }

  @Throttle(authStrictThrottlePolicy)
  @Post('refresh')
  async refresh(@Body() body: unknown, @Res() res: Response): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({ method: 'POST', path: '/auth/refresh', body }),
    );
  }

  @Post('logout')
  async logout(@Body() body: unknown, @Res() res: Response): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({ method: 'POST', path: '/auth/logout', body }),
    );
  }
}
