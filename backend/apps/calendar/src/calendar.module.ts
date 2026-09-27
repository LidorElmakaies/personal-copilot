import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './api/controllers/health.controller';
import { ShabbatController } from './api/controllers/shabbat.controller';
import { ShabbatService } from './application/shabbat.service';
import { HebcalCalendarCalculator } from './infrastructure/hebcal/hebcal-calendar.calculator';
import { CALENDAR_CALCULATOR, SHABBAT_SERVICE } from './tokens';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, ShabbatController],
  providers: [
    { provide: SHABBAT_SERVICE, useClass: ShabbatService },
    { provide: CALENDAR_CALCULATOR, useClass: HebcalCalendarCalculator },
  ],
})
export class CalendarModule {}
