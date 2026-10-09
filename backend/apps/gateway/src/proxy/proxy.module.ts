import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthKernelModule } from '@app/auth-kernel';
import { ProxyController } from './api/proxy.controller';
import { ProxyService } from './application/proxy.service';
import type { ServiceClients } from './application/interfaces/service-client.interface';
import { createServiceHttpClient } from './infrastructure/service-http.client';
import { PROXY_SERVICE, SERVICE_CLIENTS } from '../tokens';

// Forwards PROXY_ROUTES (proxy.routes.ts) to Users, Reminders and Notifications.
@Module({
  imports: [HttpModule, AuthKernelModule],
  controllers: [ProxyController],
  providers: [
    { provide: PROXY_SERVICE, useClass: ProxyService },
    {
      provide: SERVICE_CLIENTS,
      useFactory: (
        http: HttpService,
        config: ConfigService,
      ): ServiceClients => ({
        users: createServiceHttpClient(
          http,
          config,
          'USERS_SERVICE_URL',
          'users_service',
        ),
        reminders: createServiceHttpClient(
          http,
          config,
          'REMINDERS_SERVICE_URL',
          'reminders_service',
        ),
        notifications: createServiceHttpClient(
          http,
          config,
          'NOTIFICATIONS_SERVICE_URL',
          'notifications_service',
        ),
      }),
      inject: [HttpService, ConfigService],
    },
  ],
})
export class ProxyModule {}
