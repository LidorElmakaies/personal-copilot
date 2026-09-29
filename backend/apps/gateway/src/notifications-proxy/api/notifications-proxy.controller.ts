import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Post,
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
import { NOTIFICATIONS_PROXY_SERVICE } from '../../tokens';
import { writeProxyResponse } from '../../proxy/write-proxy-response';
import type { INotificationsProxyService } from '../application/interfaces/notifications-proxy-service.interface';

// Pure passthrough — the guard resolves the user, Notification Service validates the body.
@Controller('notifications')
export class NotificationsProxyController {
  constructor(
    @Inject(NOTIFICATIONS_PROXY_SERVICE)
    private readonly proxy: INotificationsProxyService,
  ) {}

  @Get('vapid-public-key')
  async vapidPublicKey(@Res() res: Response): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'GET',
        path: '/notifications/vapid-public-key',
      }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions')
  async subscribe(
    @CurrentUser() user: AuthTokenPayload,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'POST',
        path: '/notifications/subscriptions',
        body,
        headers: { [USER_ID_HEADER]: user.userId },
      }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscriptions')
  async unsubscribe(
    @CurrentUser() user: AuthTokenPayload,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'DELETE',
        path: '/notifications/subscriptions',
        body,
        headers: { [USER_ID_HEADER]: user.userId },
      }),
    );
  }
}
