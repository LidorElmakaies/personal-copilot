import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ShabbatQueryDto } from './shabbat-query.dto';

// The location fields (lat, lon) are /calendar/shabbat's.
export class MonthQueryDto extends ShabbatQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
