import { Matches, MaxLength, ValidateBy } from 'class-validator';

// An FCM registration token: letters, digits, '-', '_' and ':' (about 160 characters today).
const FCM_TOKEN = /^[A-Za-z0-9_:-]+$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const IsDeviceKey = () =>
  ValidateBy({
    name: 'isDeviceKey',
    validator: {
      validate: (v) =>
        typeof v === 'string' &&
        BASE64.test(v) &&
        Buffer.from(v, 'base64').length === 32,
      defaultMessage: () => 'key must be base64 of exactly 32 bytes',
    },
  });

export class RegisterFcmDeviceDto {
  @Matches(FCM_TOKEN, { message: 'token must be an FCM registration token' })
  @MaxLength(4096)
  token!: string;

  @MaxLength(64)
  @IsDeviceKey()
  key!: string;
}

export class DeleteFcmDeviceDto {
  @Matches(FCM_TOKEN, { message: 'token must be an FCM registration token' })
  @MaxLength(4096)
  token!: string;
}
