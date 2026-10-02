import { IsISO8601, IsOptional, Matches } from 'class-validator';
import { ShabbatQueryDto } from './shabbat-query.dto';

export class NextCandleLightingQueryDto extends ShabbatQueryDto {
  /** Defaults to now. Must carry `Z` or an offset, so it never depends on the server's zone. */
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:?\d{2})$/, {
    message: 'after must end in Z or a UTC offset',
  })
  after?: string;
}
