import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkajsEventConsumer } from '@app/kafka-client';
import { KAFKA_CONSUMER_GROUPS } from '@app/kafka-contracts';
import { RealtimeModule } from '../realtime/realtime.module';
import { FrontendReleaseConsumer } from './api/consumers/frontend-release.consumer';
import { AppUpdateNotifierService } from './application/app-update-notifier.service';
import { EVENT_CONSUMER } from '../tokens';

// Tells every open /ws connection when a new app release is published (`app-update`), on
// `frontend.releases` from apk.js publish.
@Module({
  imports: [RealtimeModule],
  providers: [
    AppUpdateNotifierService,
    FrontendReleaseConsumer,
    {
      provide: EVENT_CONSUMER,
      useFactory: (config: ConfigService) =>
        new KafkajsEventConsumer(
          config,
          'gateway',
          KAFKA_CONSUMER_GROUPS.GATEWAY,
        ),
      inject: [ConfigService],
    },
  ],
})
export class AppUpdateModule {}
