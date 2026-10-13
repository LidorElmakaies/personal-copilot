import { Module } from '@nestjs/common';
import { MonthCalendar, ShabbatCalendar } from '@app/jewish-calendar';
import { CalendarController } from './api/calendar.controller';
import { MONTH_CALENDAR, SHABBAT_CALENDAR } from '../tokens';

// Computed by Gateway itself (@app/jewish-calendar, in-process). Global rate limit only — read-only
// and cheap.
@Module({
  controllers: [CalendarController],
  providers: [
    { provide: SHABBAT_CALENDAR, useValue: new ShabbatCalendar() },
    { provide: MONTH_CALENDAR, useValue: new MonthCalendar() },
  ],
})
export class CalendarModule {}
