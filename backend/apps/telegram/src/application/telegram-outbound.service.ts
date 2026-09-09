import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TelegramSendMessage } from '@app/kafka-contracts';
import { TELEGRAM_CLIENT, TELEGRAM_LINK_SERVICE } from '../tokens';
import type { ITelegramClient } from '../infrastructure/interfaces/telegram-client.interface';
import type { ITelegramLinkService } from './interfaces/telegram-link-service.interface';
import type { ITelegramOutboundService } from './interfaces/telegram-outbound-service.interface';

@Injectable()
export class TelegramOutboundService implements ITelegramOutboundService {
  private readonly logger = new Logger(TelegramOutboundService.name);

  constructor(
    @Inject(TELEGRAM_CLIENT) private readonly client: ITelegramClient,
    @Inject(TELEGRAM_LINK_SERVICE) private readonly linkService: ITelegramLinkService,
  ) {}

  async send(message: TelegramSendMessage): Promise<void> {
    const chatIds = await this.resolveChatIds(message.userId);
    await Promise.all(
      chatIds.map((chatId) =>
        message.buttons?.length
          ? this.client.sendMenu(chatId, message.text, message.buttons)
          : this.client.sendText(chatId, message.text),
      ),
    );
  }

  private async resolveChatIds(userId: string | undefined): Promise<string[]> {
    if (!userId) return this.linkService.allLinkedChatIds();

    const chatId = await this.linkService.findChatIdByUserId(userId);
    if (!chatId) {
      this.logger.warn(`No linked Telegram chat for user ${userId} — message dropped`);
      return [];
    }
    return [chatId];
  }
}
