import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullmqQueueConsumer } from '@app/queue-client';
import { NotificationRequestedConsumer } from './api/consumers/notification-requested.consumer';
import { HealthController } from './api/controllers/health.controller';
import { PushSubscriptionsController } from './api/controllers/push-subscriptions.controller';
import { NotificationDeliveryService } from './application/notification-delivery.service';
import { PushSubscriptionService } from './application/push-subscription.service';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { TypeOrmPushSubscriptionRepository } from './infrastructure/postgres/typeorm-push-subscription.repository';
import { WebPushLibSender } from './infrastructure/webpush/web-push-lib.sender';
import { WebPushChannel } from './infrastructure/webpush/web-push.channel';
import type { VapidConfig } from './models/vapid-config';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_SERVICE,
  PUSH_SENDER,
  PUSH_SUBSCRIPTION_REPOSITORY,
  PUSH_SUBSCRIPTION_SERVICE,
  QUEUE_CONSUMER,
  VAPID_CONFIG,
} from './tokens';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('NOTIFICATIONS_DATABASE_URL'),
        entities: [PushSubscriptionEntity],
        // Same policy as Auth — see backend/apps/auth/README.md's "synchronize: true below production".
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([PushSubscriptionEntity]),
  ],
  controllers: [HealthController, PushSubscriptionsController],
  providers: [
    { provide: PUSH_SUBSCRIPTION_SERVICE, useClass: PushSubscriptionService },
    {
      provide: PUSH_SUBSCRIPTION_REPOSITORY,
      useClass: TypeOrmPushSubscriptionRepository,
    },
    {
      provide: NOTIFICATION_DELIVERY_SERVICE,
      useClass: NotificationDeliveryService,
    },
    { provide: PUSH_SENDER, useClass: WebPushLibSender },
    WebPushChannel,
    {
      // A new channel (email, SMS) is one more adapter in this list.
      provide: NOTIFICATION_CHANNELS,
      useFactory: (webPush: WebPushChannel) => [webPush],
      inject: [WebPushChannel],
    },
    {
      provide: QUEUE_CONSUMER,
      useFactory: (config: ConfigService) => new BullmqQueueConsumer(config),
      inject: [ConfigService],
    },
    NotificationRequestedConsumer,
    {
      // Fails at boot, not at first push, if a key is missing.
      provide: VAPID_CONFIG,
      useFactory: (config: ConfigService): VapidConfig => ({
        publicKey: config.getOrThrow<string>('VAPID_PUBLIC_KEY'),
        privateKey: config.getOrThrow<string>('VAPID_PRIVATE_KEY'),
        subject: config.getOrThrow<string>('VAPID_SUBJECT'),
      }),
      inject: [ConfigService],
    },
  ],
})
export class NotificationsModule {}
