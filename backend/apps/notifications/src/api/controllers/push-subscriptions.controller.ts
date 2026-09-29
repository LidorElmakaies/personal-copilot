import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';
import { ForwardedUserId } from '@app/auth-kernel';
import { PUSH_SUBSCRIPTION_SERVICE } from '../../tokens';
import type { IPushSubscriptionService } from '../../application/interfaces/push-subscription-service.interface';
import {
  CreatePushSubscriptionDto,
  DeletePushSubscriptionDto,
} from '../dto/push-subscription.dto';

@Controller('notifications')
export class PushSubscriptionsController {
  constructor(
    @Inject(PUSH_SUBSCRIPTION_SERVICE)
    private readonly service: IPushSubscriptionService,
  ) {}

  @Get('vapid-public-key')
  vapidPublicKey() {
    return { publicKey: this.service.vapidPublicKey() };
  }

  @Post('subscriptions')
  @HttpCode(204)
  async subscribe(
    @ForwardedUserId() userId: string,
    @Body() dto: CreatePushSubscriptionDto,
  ): Promise<void> {
    await this.service.subscribe(userId, {
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    });
  }

  @Delete('subscriptions')
  @HttpCode(204)
  async unsubscribe(
    @ForwardedUserId() userId: string,
    @Body() dto: DeletePushSubscriptionDto,
  ): Promise<void> {
    await this.service.unsubscribe(userId, dto.endpoint);
  }
}
