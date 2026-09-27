import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CalendarProxyController } from './api/calendar-proxy.controller';
import { CalendarProxyService } from './application/calendar-proxy.service';
import { createServiceHttpClient } from '../proxy/service-http.client';
import { CALENDAR_PROXY_SERVICE, CALENDAR_SERVICE_CLIENT } from '../tokens';

// Unguarded (Home works signed out); covered by the global rate limit only — read-only and cheap.
@Module({
  imports: [HttpModule],
  controllers: [CalendarProxyController],
  providers: [
    { provide: CALENDAR_PROXY_SERVICE, useClass: CalendarProxyService },
    {
      provide: CALENDAR_SERVICE_CLIENT,
      useFactory: (http: HttpService, config: ConfigService) =>
        createServiceHttpClient(
          http,
          config,
          'CALENDAR_SERVICE_URL',
          'calendar_service',
        ),
      inject: [HttpService, ConfigService],
    },
  ],
})
export class CalendarProxyModule {}
