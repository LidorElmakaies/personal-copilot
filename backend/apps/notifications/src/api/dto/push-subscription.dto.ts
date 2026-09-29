import { Type } from 'class-transformer';
import {
  IsObject,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

// Push services only hand out https endpoints; also keeps the sender (task 2.3) off plain-http internal hosts.
const pushEndpoint = () =>
  IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true });

export class PushSubscriptionKeysDto {
  @Matches(BASE64URL)
  @MaxLength(128)
  p256dh!: string;

  @Matches(BASE64URL)
  @MaxLength(64)
  auth!: string;
}

/** The browser's PushSubscription.toJSON(), posted as-is (expirationTime is dropped by the whitelist). */
export class CreatePushSubscriptionDto {
  @pushEndpoint()
  @MaxLength(2048)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}

export class DeletePushSubscriptionDto {
  @pushEndpoint()
  @MaxLength(2048)
  endpoint!: string;
}
