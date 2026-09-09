import { Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, type AuthTokenPayload } from '@app/auth-kernel';
import { TELEGRAM_PROXY_SERVICE } from '../../tokens';
import type { ITelegramProxyService } from '../application/interfaces/telegram-proxy-service.interface';

// First guarded route in this app — every other endpoint so far is either an unguarded auth
// pass-through or the WS handshake's own token check.
@Controller('telegram')
export class TelegramProxyController {
  constructor(
    @Inject(TELEGRAM_PROXY_SERVICE) private readonly proxy: ITelegramProxyService,
  ) {}

  // 202, not 200 — this only enqueues the request. The code itself arrives later over the
  // caller's WS connection (TelegramLinkCreatedConsumer), not in this response.
  @UseGuards(JwtAuthGuard)
  @Post('link-code')
  @HttpCode(202)
  async linkCode(@CurrentUser() user: AuthTokenPayload): Promise<void> {
    await this.proxy.requestLinkCode(user.userId);
  }
}
