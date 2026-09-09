import { Inject, Injectable } from '@nestjs/common';
import type { IEventPublisher } from '@app/kafka-client';
import { KAFKA_TOPICS, type TelegramReceivedMessage } from '@app/kafka-contracts';
import { t } from '../i18n/messages';
import { EVENT_PUBLISHER, TELEGRAM_CLIENT, TELEGRAM_LINK_SERVICE } from '../tokens';
import type { ITelegramClient } from '../infrastructure/interfaces/telegram-client.interface';
import type { TelegramUpdate } from '../models/telegram-update';
import type { ITelegramLinkService } from './interfaces/telegram-link-service.interface';
import type { ITelegramInboundService } from './interfaces/telegram-inbound-service.interface';

@Injectable()
export class TelegramInboundService implements ITelegramInboundService {
  constructor(
    @Inject(EVENT_PUBLISHER) private readonly publisher: IEventPublisher,
    @Inject(TELEGRAM_LINK_SERVICE) private readonly linkService: ITelegramLinkService,
    @Inject(TELEGRAM_CLIENT) private readonly client: ITelegramClient,
  ) {}

  async handle(update: TelegramUpdate): Promise<void> {
    const userId = await this.linkService.findUserIdByChatId(update.chatId);
    if (!userId) {
      await this.handleUnlinked(update);
      return;
    }

    const receivedAt = new Date().toISOString();
    const message: TelegramReceivedMessage =
      update.kind === 'button'
        ? { kind: 'button', userId, data: update.data, receivedAt }
        : { kind: 'text', userId, text: update.text, receivedAt };
    await this.publisher.publish(KAFKA_TOPICS.TELEGRAM_MESSAGE_RECEIVED, userId, message);
  }

  // An unlinked chat can't do anything yet except redeem a code — a button tap has no meaning
  // here, since nothing was ever sent to a chat we don't recognize.
  private async handleUnlinked(update: TelegramUpdate): Promise<void> {
    if (update.kind !== 'text') return;

    // Telegram deep links (t.me/<bot>?start=CODE) arrive as "/start CODE" — accept either form.
    const candidate = update.text.replace(/^\/start\s*/, '').trim();
    const userId = candidate ? await this.linkService.redeemCode(candidate, update.chatId) : null;

    await this.client.sendText(
      update.chatId,
      t(userId ? 'linked' : 'sendLinkCode', update.languageCode),
    );
  }
}
