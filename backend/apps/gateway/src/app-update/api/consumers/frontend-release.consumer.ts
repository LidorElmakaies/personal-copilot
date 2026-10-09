import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IEventConsumer } from '@app/kafka-client';
import { isFrontendReleaseMessage, KAFKA_TOPICS } from '@app/kafka-contracts';
import { EVENT_CONSUMER } from '../../../tokens';
import { AppUpdateNotifierService } from '../../application/app-update-notifier.service';

// Event entry point: `apk.js publish` announced a new app release.
@Injectable()
export class FrontendReleaseConsumer implements OnModuleInit {
  constructor(
    @Inject(EVENT_CONSUMER) private readonly consumer: IEventConsumer,
    private readonly notifier: AppUpdateNotifierService,
  ) {}

  onModuleInit(): void {
    this.consumer.subscribe(
      KAFKA_TOPICS.FRONTEND_RELEASES,
      isFrontendReleaseMessage,
      () => Promise.resolve(this.notifier.releasePublished()),
    );
  }
}
