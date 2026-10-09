import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AppUpdateModule } from './app-update/app-update.module';
import { CalendarModule } from './calendar/calendar.module';
import { ProxyModule } from './proxy/proxy.module';
import { RealtimeModule } from './realtime/realtime.module';

// Composes the self-contained modules below, plus global rate limiting (keyed on the client IP
// main.ts's trust-proxy setting resolves — see trust-proxy.ts).
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60000),
            limit: Number(config.get('THROTTLE_LIMIT') ?? 100),
          },
        ],
      }),
    }),
    ProxyModule,
    CalendarModule,
    AdminModule,
    RealtimeModule,
    AppUpdateModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class GatewayModule {}
