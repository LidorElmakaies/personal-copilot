import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsTimeZone } from 'class-validator';

export class ShabbatQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lon!: number;

  @IsTimeZone()
  tz!: string;
}
