import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CALENDAR_PROXY_SERVICE } from '../../tokens';
import { writeProxyResponse } from '../../proxy/write-proxy-response';
import type { ICalendarProxyService } from '../application/interfaces/calendar-proxy-service.interface';

// Pure passthrough to Calendar Service — validation happens there, its 400s are relayed as-is.
@Controller('calendar')
export class CalendarProxyController {
  constructor(
    @Inject(CALENDAR_PROXY_SERVICE)
    private readonly proxy: ICalendarProxyService,
  ) {}

  @Get('shabbat')
  async shabbat(
    @Query('lat') lat: unknown,
    @Query('lon') lon: unknown,
    @Query('tz') tz: unknown,
    @Res() res: Response,
  ): Promise<void> {
    writeProxyResponse(
      res,
      await this.proxy.forward({
        method: 'GET',
        path: '/calendar/shabbat',
        query: { lat, lon, tz },
      }),
    );
  }
}
