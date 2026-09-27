import { Controller, Get, Inject, Query } from '@nestjs/common';
import { SHABBAT_SERVICE } from '../../tokens';
import type { IShabbatService } from '../../application/interfaces/shabbat-service.interface';
import { ShabbatQueryDto } from '../dto/shabbat-query.dto';

@Controller('calendar')
export class ShabbatController {
  constructor(
    @Inject(SHABBAT_SERVICE) private readonly shabbatService: IShabbatService,
  ) {}

  @Get('shabbat')
  shabbat(@Query() query: ShabbatQueryDto) {
    return this.shabbatService.current(
      { latitude: query.lat, longitude: query.lon, timeZone: query.tz },
      new Date(),
    );
  }
}
