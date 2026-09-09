import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IEventConsumer, IEventPublisher } from '@app/kafka-client';
import {
  KAFKA_CONSUMER_GROUPS,
  KAFKA_TOPICS,
  type TelegramLinkCreated,
  type TelegramLinkRequested,
} from '@app/kafka-contracts';
import { EVENT_CONSUMER, EVENT_PUBLISHER, TELEGRAM_LINK_SERVICE } from '../tokens';
import type { ITelegramLinkService } from '../application/interfaces/telegram-link-service.interface';

// Entry point for Gateway asking us to mint a linking code — the request/response round trip goes
// entirely through Kafka (no HTTP surface on this service at all), same shape a future
// @EventPattern consumer in any other app would follow.
@Injectable()
export class TelegramLinkRequestConsumer implements OnModuleInit {
  constructor(
    @Inject(EVENT_CONSUMER) private readonly consumer: IEventConsumer,
    @Inject(EVENT_PUBLISHER) private readonly publisher: IEventPublisher,
    @Inject(TELEGRAM_LINK_SERVICE) private readonly linkService: ITelegramLinkService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe<TelegramLinkRequested>(
      KAFKA_TOPICS.TELEGRAM_LINK_REQUESTED,
      KAFKA_CONSUMER_GROUPS.TELEGRAM_LINK_REQUEST_CONSUMER,
      async ({ userId }) => {
        const { code, url, expiresAt } = await this.linkService.generateCode(userId);
        const event: TelegramLinkCreated = {
          userId,
          code,
          url,
          expiresAt: expiresAt.toISOString(),
        };
        await this.publisher.publish(KAFKA_TOPICS.TELEGRAM_LINK_CREATED, userId, event);
      },
    );
  }
}
