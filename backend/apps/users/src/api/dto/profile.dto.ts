import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
} from 'class-validator';
import {
  NAME_MAX_LENGTH,
  NAME_PATTERN,
  PHONE_E164,
} from '@app/kafka-contracts';
import type { Profile } from '../../models/profile';

const NAME_RULE = {
  message:
    '$property may contain only English or Hebrew letters and single spaces',
};

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Optional name/phone fields, shared by register and PATCH /users/me. Null (PATCH) clears one. */
export class ProfileDetailsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, NAME_RULE)
  firstName?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, NAME_RULE)
  lastName?: string | null;

  @IsOptional()
  @Matches(PHONE_E164, {
    message: 'phone must be in international format, e.g. +972501234567',
  })
  phone?: string | null;
}

export class LocationDto {
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @IsNumber()
  @IsLongitude()
  lon!: number;

  @IsTimeZone()
  tz!: string;
}

/** The client-facing shape: no user id (the caller's own) or version (internal). */
export const toProfileResponse = (p: Profile) => ({
  firstName: p.firstName,
  lastName: p.lastName,
  phone: p.phone,
  location: p.location && {
    lat: p.location.lat,
    lon: p.location.lon,
    tz: p.location.tz,
    updatedAt: p.location.updatedAt.toISOString(),
  },
});
