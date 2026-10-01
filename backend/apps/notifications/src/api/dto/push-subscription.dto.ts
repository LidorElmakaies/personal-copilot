import { Type } from 'class-transformer';
import {
  IsObject,
  IsUrl,
  MaxLength,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { isAllowedPushEndpoint } from '../../models/push-endpoint-policy';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

// A browser always sends a P-256 public key (65 bytes, uncompressed) and a 16-byte auth secret.
const DecodesToBytes = (bytes: number) =>
  ValidateBy({
    name: 'decodesToBytes',
    validator: {
      validate: (v) =>
        typeof v === 'string' &&
        BASE64URL.test(v) &&
        Buffer.from(v, 'base64url').length === bytes,
      defaultMessage: (args) =>
        `${args?.property} must be base64url of exactly ${bytes} bytes`,
    },
  });

const IsAllowedPushEndpoint = () =>
  ValidateBy({
    name: 'isAllowedPushEndpoint',
    validator: {
      validate: (v) => typeof v === 'string' && isAllowedPushEndpoint(v),
      defaultMessage: () =>
        'endpoint must be an https URL on a known push service',
    },
  });

export class PushSubscriptionKeysDto {
  @MaxLength(128)
  @DecodesToBytes(65)
  p256dh!: string;

  @MaxLength(64)
  @DecodesToBytes(16)
  auth!: string;
}

/** The browser's PushSubscription.toJSON(), posted as-is (expirationTime is dropped by the whitelist). */
export class CreatePushSubscriptionDto {
  @IsAllowedPushEndpoint()
  @MaxLength(2048)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}

export class DeletePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;
}
