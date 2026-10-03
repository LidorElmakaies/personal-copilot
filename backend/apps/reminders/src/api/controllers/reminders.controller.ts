import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Put,
} from '@nestjs/common';
import { ForwardedUserId } from '@app/auth-kernel';
import { REMINDER_SERVICE } from '../../tokens';
import type { IReminderService } from '../../application/interfaces/reminder-service.interface';
import { ReminderSettingsDto, toReminderResponse } from '../dto/reminder.dto';

@Controller('reminders')
export class RemindersController {
  constructor(
    @Inject(REMINDER_SERVICE) private readonly service: IReminderService,
  ) {}

  @Get()
  async list(@ForwardedUserId() userId: string) {
    return (await this.service.list(userId)).map(toReminderResponse);
  }

  @Put('shabbat-candles')
  async saveShabbatCandles(
    @ForwardedUserId() userId: string,
    @Body() dto: ReminderSettingsDto,
  ) {
    return toReminderResponse(
      await this.service.save(userId, 'shabbat_candles', {
        offsetMinutes: dto.offsetMinutes,
        lat: dto.lat,
        lon: dto.lon,
        tz: dto.tz,
      }),
    );
  }

  @Delete('shabbat-candles')
  @HttpCode(204)
  async turnOffShabbatCandles(
    @ForwardedUserId() userId: string,
  ): Promise<void> {
    await this.service.turnOff(userId, 'shabbat_candles');
  }
}
