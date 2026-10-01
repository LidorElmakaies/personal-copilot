import type { NotificationChannel } from '@app/queue-contracts';
import type { NotificationContent } from '../../models/notification-content';
import type { IDeliveryProgress } from './delivery-progress.interface';

/** One way of reaching a user (Web Push today). Implemented by WebPushChannel. */
export interface INotificationChannel {
  readonly name: NotificationChannel;
  /** Skips addresses `progress` marks done; throws RetryableDeliveryException if any should be retried. */
  deliver(
    userId: string,
    content: NotificationContent,
    expiresAt: Date,
    progress: IDeliveryProgress,
  ): Promise<void>;
}
