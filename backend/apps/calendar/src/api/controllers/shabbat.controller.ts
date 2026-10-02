import { Controller, Get, Inject, Query } from '@nestjs/common';
import { SHABBAT_SERVICE } from '../../tokens';
import type { IShabbatService } from '../../application/interfaces/shabbat-service.interface';
import type { GeoLocation } from '../../models/geo-location';
import { NextCandleLightingQueryDto } from '../dto/next-candle-lighting-query.dto';
import { ShabbatQueryDto } from '../dto/shabbat-query.dto';

@Controller('calendar')
export class ShabbatController {
  constructor(
    @Inject(SHABBAT_SERVICE) private readonly shabbatService: IShabbatService,
  ) {}

  @Get('shabbat')
  shabbat(@Query() query: ShabbatQueryDto) {
    return this.shabbatService.current(locationOf(query), new Date());
  }

  // Internal: Reminders calls this. Gateway's calendar-proxy doesn't forward it.
  @Get('candle-lighting/next')
  nextCandleLighting(@Query() query: NextCandleLightingQueryDto) {
    const after = query.after ? new Date(query.after) : new Date();
    return {
      candleLighting: this.shabbatService.nextCandleLighting(
        locationOf(query),
        after,
      ),
    };
  }
}

function locationOf(query: ShabbatQueryDto): GeoLocation {
  return { latitude: query.lat, longitude: query.lon, timeZone: query.tz };
}
