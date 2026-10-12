import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullmqQueueConsumer } from '@app/queue-client';
import { NotificationRequestedConsumer } from './api/consumers/notification-requested.consumer';
import { FcmDevicesController } from './api/controllers/fcm-devices.controller';
import { HealthController } from './api/controllers/health.controller';
import { PushSubscriptionsController } from './api/controllers/push-subscriptions.controller';
import { FcmDeviceService } from './application/fcm-device.service';
import { NotificationDeliveryService } from './application/notification-delivery.service';
import { PushSubscriptionService } from './application/push-subscription.service';
import { FcmDeviceEntity } from './entities/fcm-device.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { UsersUserEntity } from '@app/users-schema';
import { FcmChannel } from './infrastructure/fcm/fcm.channel';
import { FcmHttpSender } from './infrastructure/fcm/fcm-http.sender';
import { TypeOrmFcmDeviceRepository } from './infrastructure/postgres/typeorm-fcm-device.repository';
import { TypeOrmPushSubscriptionRepository } from './infrastructure/postgres/typeorm-push-subscription.repository';
import { WebPushLibSender } from './infrastructure/webpush/web-push-lib.sender';
import { WebPushChannel } from './infrastructure/webpush/web-push.channel';
import type { FcmConfig } from './models/fcm-config';
import type { VapidConfig } from './models/vapid-config';
import {
  FCM_CONFIG,
  FCM_DEVICE_REPOSITORY,
  FCM_DEVICE_SERVICE,
  FCM_SENDER,
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
        url: config.get<string>('DATABASE_URL'),
        // This service's own schema in the shared database — the only one it writes.
        schema: 'notifications',
        // UsersUserEntity maps users.users read-only (synchronize: false), for the foreign key.
        entities: [PushSubscriptionEntity, FcmDeviceEntity, UsersUserEntity],
        // Same policy as Users — see backend/apps/users/README.md's "synchronize: true below production".
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([PushSubscriptionEntity, FcmDeviceEntity]),
  ],
  controllers: [
    HealthController,
    PushSubscriptionsController,
    FcmDevicesController,
  ],
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
    { provide: FCM_DEVICE_SERVICE, useClass: FcmDeviceService },
    { provide: FCM_DEVICE_REPOSITORY, useClass: TypeOrmFcmDeviceRepository },
    { provide: FCM_SENDER, useClass: FcmHttpSender },
    FcmChannel,
    {
      // A new channel (email, SMS) is one more adapter in this list.
      provide: NOTIFICATION_CHANNELS,
      useFactory: (
        webPush: WebPushChannel,
        fcm: FcmChannel,
        fcmConfig: FcmConfig | null,
      ) => (fcmConfig ? [webPush, fcm] : [webPush]),
      inject: [WebPushChannel, FcmChannel, FCM_CONFIG],
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
    {
      // Optional, unlike VAPID: without it Android devices are still registered, just not sent to.
      provide: FCM_CONFIG,
      useFactory: (config: ConfigService): FcmConfig | null => {
        const projectId = config.get<string>('FCM_PROJECT_ID');
        const clientEmail = config.get<string>('FCM_CLIENT_EMAIL');
        const privateKey = config.get<string>('FCM_PRIVATE_KEY');
        if (!projectId || !clientEmail || !privateKey) {
          new Logger('NotificationsModule').warn(
            'FCM_* not set: the Android (FCM) channel is off',
          );
          return null;
        }
        // One line in .env; a literal \n left unexpanded still becomes a newline.
        return {
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        };
      },
      inject: [ConfigService],
    },
  ],
})
export class NotificationsModule {}
