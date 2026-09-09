import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { IEventConsumer } from '@app/kafka-client';
import {
  KAFKA_CONSUMER_GROUPS,
  KAFKA_TOPICS,
  type TelegramLinkCreated,
} from '@app/kafka-contracts';
import { EVENT_CONSUMER, REALTIME_CONNECTION_SERVICE } from '../../tokens';
import type { IRealtimeConnectionService } from '../../realtime/application/interfaces/realtime-connection.interface';

// Entry point for apps/telegram reporting a minted code back — delivered to the requesting user
// over their live WS connection (event 'telegram:link-code'), not as an HTTP response. A user with
// no open connection at the moment this arrives just doesn't see it — pushToUser says so, not an
// error — and has to tap "Get linking code" again once reconnected.
@Injectable()
export class TelegramLinkCreatedConsumer implements OnModuleInit {
  private readonly logger = new Logger(TelegramLinkCreatedConsumer.name);

  constructor(
    @Inject(EVENT_CONSUMER) private readonly consumer: IEventConsumer,
    @Inject(REALTIME_CONNECTION_SERVICE)
    private readonly realtimeConnectionService: IRealtimeConnectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe<TelegramLinkCreated>(
      KAFKA_TOPICS.TELEGRAM_LINK_CREATED,
      KAFKA_CONSUMER_GROUPS.GATEWAY_TELEGRAM_LINK_CONSUMER,
      async ({ userId, code, url, expiresAt }) => {
        const delivered = this.realtimeConnectionService.pushToUser(userId, 'telegram:link-code', {
          code,
          url,
          expiresAt,
        });
        if (!delivered) {
          this.logger.warn(`User ${userId} has no open connection — link code not delivered`);
        }
      },
    );
  }
}
