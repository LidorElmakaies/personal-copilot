import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthKernelModule } from '@app/auth-kernel';
import { RemindersProxyController } from './api/reminders-proxy.controller';
import { RemindersProxyService } from './application/reminders-proxy.service';
import { createServiceHttpClient } from '../proxy/service-http.client';
import { REMINDERS_PROXY_SERVICE, REMINDERS_SERVICE_CLIENT } from '../tokens';

// Every route is JwtAuthGuard-gated: reminders are per user.
@Module({
  imports: [HttpModule, AuthKernelModule],
  controllers: [RemindersProxyController],
  providers: [
    { provide: REMINDERS_PROXY_SERVICE, useClass: RemindersProxyService },
    {
      provide: REMINDERS_SERVICE_CLIENT,
      useFactory: (http: HttpService, config: ConfigService) =>
        createServiceHttpClient(
          http,
          config,
          'REMINDERS_SERVICE_URL',
          'reminders_service',
        ),
      inject: [HttpService, ConfigService],
    },
  ],
})
export class RemindersProxyModule {}
