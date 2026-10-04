import { Module } from '@nestjs/common';
import { ShabbatCalendar } from '@app/jewish-calendar';
import { CalendarController } from './api/calendar.controller';
import { SHABBAT_CALENDAR } from '../tokens';

// The one Gateway module with logic of its own — the deliberate exception to "Gateway only
// forwards" (see CLAUDE.md). Covered by the global rate limit only — read-only and cheap.
@Module({
  controllers: [CalendarController],
  providers: [{ provide: SHABBAT_CALENDAR, useValue: new ShabbatCalendar() }],
})
export class CalendarModule {}
