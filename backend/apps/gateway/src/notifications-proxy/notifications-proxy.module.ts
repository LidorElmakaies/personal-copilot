import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthKernelModule } from '@app/auth-kernel';
import { NotificationsProxyController } from './api/notifications-proxy.controller';
import { NotificationsProxyService } from './application/notifications-proxy.service';
import { createServiceHttpClient } from '../proxy/service-http.client';
import {
  NOTIFICATIONS_PROXY_SERVICE,
  NOTIFICATIONS_SERVICE_CLIENT,
} from '../tokens';

// vapid-public-key is open (the browser needs it before login matters); subscriptions are JwtAuthGuard-gated.
@Module({
  imports: [HttpModule, AuthKernelModule],
  controllers: [NotificationsProxyController],
  providers: [
    {
      provide: NOTIFICATIONS_PROXY_SERVICE,
      useClass: NotificationsProxyService,
    },
    {
      provide: NOTIFICATIONS_SERVICE_CLIENT,
      useFactory: (http: HttpService, config: ConfigService) =>
        createServiceHttpClient(
          http,
          config,
          'NOTIFICATIONS_SERVICE_URL',
          'notifications_service',
        ),
      inject: [HttpService, ConfigService],
    },
  ],
})
export class NotificationsProxyModule {}
