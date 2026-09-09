import { Inject, Injectable } from '@nestjs/common';
import type { IEventPublisher } from '@app/kafka-client';
import { KAFKA_TOPICS, type TelegramLinkRequested } from '@app/kafka-contracts';
import { EVENT_PUBLISHER } from '../../tokens';
import type { ITelegramProxyService } from './interfaces/telegram-proxy-service.interface';

@Injectable()
export class TelegramProxyService implements ITelegramProxyService {
  constructor(@Inject(EVENT_PUBLISHER) private readonly publisher: IEventPublisher) {}

  async requestLinkCode(userId: string): Promise<void> {
    const event: TelegramLinkRequested = { userId };
    await this.publisher.publish(KAFKA_TOPICS.TELEGRAM_LINK_REQUESTED, userId, event);
  }
}
