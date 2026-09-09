import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IEventConsumer } from '@app/kafka-client';
import {
  KAFKA_CONSUMER_GROUPS,
  KAFKA_TOPICS,
  type TelegramSendMessage,
} from '@app/kafka-contracts';
import { EVENT_CONSUMER, TELEGRAM_OUTBOUND_SERVICE } from '../tokens';
import type { ITelegramOutboundService } from '../application/interfaces/telegram-outbound-service.interface';

// Entry point for any service asking us to message a user (or everyone linked) — subscribes on
// startup, one consumer group per apps/telegram (see consumer-groups.ts), same shape a future
// @EventPattern consumer in any other app would follow.
@Injectable()
export class TelegramSendConsumer implements OnModuleInit {
  constructor(
    @Inject(EVENT_CONSUMER) private readonly consumer: IEventConsumer,
    @Inject(TELEGRAM_OUTBOUND_SERVICE)
    private readonly outboundService: ITelegramOutboundService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe<TelegramSendMessage>(
      KAFKA_TOPICS.TELEGRAM_MESSAGE_SEND,
      KAFKA_CONSUMER_GROUPS.TELEGRAM_SEND_CONSUMER,
      (message) => this.outboundService.send(message),
    );
  }
}
