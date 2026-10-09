import { Inject, Injectable, Logger } from '@nestjs/common';
import { PUSH_SENDER, PUSH_SUBSCRIPTION_REPOSITORY } from '../../tokens';
import type { IDeliveryProgress } from '../../application/interfaces/delivery-progress.interface';
import type { INotificationChannel } from '../../application/interfaces/notification-channel.interface';
import { RetryableDeliveryException } from '../../application/exceptions/retryable-delivery.exception';
import type { NotificationContent } from '../../models/notification-content';
import { isAllowedPushEndpoint } from '../../models/push-endpoint-policy';
import type { IPushSender } from '../interfaces/push-sender.interface';
import type { IPushSubscriptionRepository } from '../interfaces/push-subscription-repository.interface';

/** One push per device the user has now; a device already marked done (earlier attempt) is skipped. */
@Injectable()
export class WebPushChannel implements INotificationChannel {
  readonly name = 'webpush' as const;
  private readonly logger = new Logger(WebPushChannel.name);

  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: IPushSubscriptionRepository,
    @Inject(PUSH_SENDER) private readonly sender: IPushSender,
  ) {}

  async deliver(
    userId: string,
    content: NotificationContent,
    expiresAt: Date,
    progress: IDeliveryProgress,
  ): Promise<void> {
    const payload = JSON.stringify(content);
    const label = content.notificationId;
    let retry = 0;

    for (const sub of await this.subscriptions.findByUserId(userId)) {
      const key = `webpush:${sub.id}`;
      if (progress.isDone(key)) continue;

      // Whole seconds left: the push service drops it if the device can't be reached in time.
      const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      if (ttlSeconds <= 0) {
        this.logger.warn(`Expired before every device was reached (${label})`);
        return;
      }

      // A host dropped from the allowlist since the row was saved.
      const outcome = isAllowedPushEndpoint(sub.endpoint)
        ? await this.sender.send(sub, payload, ttlSeconds)
        : 'gone';

      if (outcome === 'retry') {
        retry++;
        continue;
      }
      if (outcome === 'gone') {
        await this.subscriptions.deleteById(sub.id);
        this.logger.log(`Removed dead subscription ${sub.id} (${label})`);
      } else if (outcome === 'failed') {
        this.logger.warn(`Push to ${sub.id} failed, not retried (${label})`);
      }
      await progress.markDone(key);
    }

    if (retry > 0) {
      throw new RetryableDeliveryException(
        `${retry} device(s) busy or unreachable (${label})`,
      );
    }
  }
}
