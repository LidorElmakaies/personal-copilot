import { Controller, Get, Inject, Query } from '@nestjs/common';
import type { IShabbatCalendar } from '@app/jewish-calendar';
import { SHABBAT_CALENDAR } from '../../tokens';
import { ShabbatQueryDto } from './dto/shabbat-query.dto';

// Served by Gateway itself, not proxied: the maths is the shared @app/jewish-calendar lib, so
// there's nothing for another service to add. Unguarded — Home works signed out.
@Controller('calendar')
export class CalendarController {
  constructor(
    @Inject(SHABBAT_CALENDAR) private readonly calendar: IShabbatCalendar,
  ) {}

  @Get('shabbat')
  shabbat(@Query() query: ShabbatQueryDto) {
    return this.calendar.current(
      { latitude: query.lat, longitude: query.lon, timeZone: query.tz },
      new Date(),
    );
  }
}
