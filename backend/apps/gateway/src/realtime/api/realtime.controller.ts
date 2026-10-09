import { Controller, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DEVICE_TOKEN_SERVICE } from '@app/auth-kernel';
import type { IDeviceTokenService } from '@app/auth-kernel';
import { authStrictThrottlePolicy } from '../../throttle-policies';

// An app install's /ws identity, fetched once and kept. Open — Home works signed out — and on the
// strict rate limit: tokens are what bound how many /ws connections one client can hold.
@Controller('realtime')
export class RealtimeController {
  constructor(
    @Inject(DEVICE_TOKEN_SERVICE)
    private readonly deviceTokenService: IDeviceTokenService,
  ) {}

  @Throttle(authStrictThrottlePolicy)
  @Post('device')
  device() {
    return { device_token: this.deviceTokenService.issue() };
  }
}
