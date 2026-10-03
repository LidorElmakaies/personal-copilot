import { IsInt, Max, Min } from 'class-validator';
import type { ReminderStatus } from '../../models/reminder';

export class ReminderSettingsDto {
  /** Up to a day before candle lighting. */
  @IsInt()
  @Min(1)
  @Max(1440)
  offsetMinutes!: number;
}

/** The client-facing shape: no row id or user id. */
export const toReminderResponse = (r: ReminderStatus) => ({
  type: r.type,
  offsetMinutes: r.offsetMinutes,
  enabled: r.enabled,
  nextFireAt: r.nextFireAt?.toISOString() ?? null,
  waitingForLocation: r.waitingForLocation,
});
