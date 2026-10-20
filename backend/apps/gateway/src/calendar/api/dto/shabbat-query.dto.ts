import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

// No time zone: the app is Israel-only, so the lib always uses Israel's. An older client's `tz` is
// dropped by the ValidationPipe's whitelist.
export class ShabbatQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lon!: number;
}
