import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { TELEGRAM_CLIENT, TELEGRAM_INBOUND_SERVICE } from '../tokens';
import type { ITelegramClient } from '../infrastructure/interfaces/telegram-client.interface';
import type { ITelegramInboundService } from '../application/interfaces/telegram-inbound-service.interface';

// Entry point for updates coming *from* Telegram (a button tap or a typed message) — the
// long-polling equivalent of a controller. Whether the sending chat is linked to a user, or needs
// to redeem a link code first, is TelegramInboundService's call, not this class's.
@Injectable()
export class TelegramUpdatesListener implements OnModuleInit {
  constructor(
    @Inject(TELEGRAM_CLIENT) private readonly client: ITelegramClient,
    @Inject(TELEGRAM_INBOUND_SERVICE)
    private readonly inboundService: ITelegramInboundService,
  ) {}

  onModuleInit(): void {
    this.client.onUpdate((update) => this.inboundService.handle(update));
    this.client.start();
  }
}
