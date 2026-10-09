import { Module } from '@nestjs/common';
import { ShabbatCalendar } from '@app/jewish-calendar';
import { CalendarController } from './api/calendar.controller';
import { SHABBAT_CALENDAR } from '../tokens';

// Shabbat times computed by Gateway itself (@app/jewish-calendar, in-process). Covered by the
// global rate limit only — read-only and cheap.
@Module({
  controllers: [CalendarController],
  providers: [{ provide: SHABBAT_CALENDAR, useValue: new ShabbatCalendar() }],
})
export class CalendarModule {}
