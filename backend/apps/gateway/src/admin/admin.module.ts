import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthKernelModule } from '@app/auth-kernel';
import { AdminController } from './api/admin.controller';
import { AdminStatusService } from './application/admin-status.service';
import { HttpHealthProbe } from './infrastructure/http-health-probe';
import { ADMIN_STATUS_SERVICE, HEALTH_PROBES } from '../tokens';

// The services GET /admin/status asks, from the same *_SERVICE_URL config the proxies use.
const PROBED_SERVICES = [
  ['users', 'USERS_SERVICE_URL'],
  ['reminders', 'REMINDERS_SERVICE_URL'],
  ['notifications', 'NOTIFICATIONS_SERVICE_URL'],
] as const;

@Module({
  imports: [HttpModule, AuthKernelModule],
  controllers: [AdminController],
  providers: [
    { provide: ADMIN_STATUS_SERVICE, useClass: AdminStatusService },
    {
      provide: HEALTH_PROBES,
      useFactory: (http: HttpService, config: ConfigService) => {
        const timeoutMs = Number(config.get('ADMIN_STATUS_TIMEOUT_MS') ?? 2000);
        return PROBED_SERVICES.map(([service, urlEnvVar]) => {
          const baseUrl = config.get<string>(urlEnvVar);
          if (!baseUrl) throw new Error(`${urlEnvVar} is not configured`);
          return new HttpHealthProbe(http, service, baseUrl, timeoutMs);
        });
      },
      inject: [HttpService, ConfigService],
    },
  ],
})
export class AdminModule {}
