import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsTimeZone,
  Max,
  Min,
} from 'class-validator';
import type { Reminder } from '../../models/reminder';

export class ReminderSettingsDto {
  /** Up to a day before candle lighting. */
  @IsInt()
  @Min(1)
  @Max(1440)
  offsetMinutes!: number;

  @IsNumber()
  @IsLatitude()
  lat!: number;

  @IsNumber()
  @IsLongitude()
  lon!: number;

  @IsTimeZone()
  tz!: string;
}

/** The client-facing shape: no row id or user id. */
export const toReminderResponse = (r: Reminder) => ({
  type: r.type,
  offsetMinutes: r.offsetMinutes,
  lat: r.lat,
  lon: r.lon,
  tz: r.tz,
  enabled: r.enabled,
  nextFireAt: r.nextFireAt?.toISOString() ?? null,
});
