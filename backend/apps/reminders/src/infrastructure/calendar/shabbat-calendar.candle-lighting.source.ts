import { Inject, Injectable } from '@nestjs/common';
import type { IShabbatCalendar } from '@app/jewish-calendar';
import { SHABBAT_CALENDAR } from '../../tokens';
import type { Coordinates } from '../../models/user-location';
import type { ICandleLightingSource } from '../interfaces/candle-lighting-source.interface';

/** In-process, through @app/jewish-calendar — no network call. */
@Injectable()
export class ShabbatCalendarCandleLightingSource implements ICandleLightingSource {
  constructor(
    @Inject(SHABBAT_CALENDAR) private readonly calendar: IShabbatCalendar,
  ) {}

  nextAfter(location: Coordinates, after: Date): Promise<Date> {
    return Promise.resolve(
      this.calendar.nextCandleLighting(
        {
          latitude: location.lat,
          longitude: location.lon,
          timeZone: location.tz,
        },
        after,
      ),
    );
  }
}
