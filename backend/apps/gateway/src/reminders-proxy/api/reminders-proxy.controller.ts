import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
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
import { REMINDERS_PROXY_SERVICE } from '../../tokens';
import { writeProxyResponse } from '../../proxy/write-proxy-response';
import type { IRemindersProxyService } from '../application/interfaces/reminders-proxy-service.interface';

// Pure passthrough — the guard resolves the user, Reminders Service validates the body.
@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersProxyController {
  constructor(
    @Inject(REMINDERS_PROXY_SERVICE)
    private readonly proxy: IRemindersProxyService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthTokenPayload,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'GET',
        path: '/reminders',
        headers: { [USER_ID_HEADER]: user.userId },
      }),
    );
  }

  @Put('shabbat-candles')
  async saveShabbatCandles(
    @CurrentUser() user: AuthTokenPayload,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'PUT',
        path: '/reminders/shabbat-candles',
        body,
        headers: { [USER_ID_HEADER]: user.userId },
      }),
    );
  }

  @Delete('shabbat-candles')
  async turnOffShabbatCandles(
    @CurrentUser() user: AuthTokenPayload,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'DELETE',
        path: '/reminders/shabbat-candles',
        headers: { [USER_ID_HEADER]: user.userId },
      }),
    );
  }
}
