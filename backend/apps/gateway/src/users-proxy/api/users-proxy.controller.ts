import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  USER_ID_HEADER,
  type AuthTokenPayload,
} from '@app/auth-kernel';
import { USERS_PROXY_SERVICE } from '../../tokens';
import { writeProxyResponse } from '../../proxy/write-proxy-response';
import type { IUsersProxyService } from '../application/interfaces/users-proxy-service.interface';

// Pure passthrough — the guard resolves the user, Users Service validates the body.
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersProxyController {
  constructor(
    @Inject(USERS_PROXY_SERVICE)
    private readonly proxy: IUsersProxyService,
  ) {}

  @Get()
  async get(
    @CurrentUser() user: AuthTokenPayload,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'GET',
        path: '/users/me',
        headers: { [USER_ID_HEADER]: user.userId },
      }),
    );
  }

  @Patch()
  async updateDetails(
    @CurrentUser() user: AuthTokenPayload,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'PATCH',
        path: '/users/me',
        body,
        headers: { [USER_ID_HEADER]: user.userId },
      }),
    );
  }

  @Put('location')
  async setLocation(
    @CurrentUser() user: AuthTokenPayload,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'PUT',
        path: '/users/me/location',
        body,
        headers: { [USER_ID_HEADER]: user.userId },
      }),
    );
  }
}
