import type { NotificationRequestedMessage } from '@app/queue-contracts';
import type { IDeliveryProgress } from './delivery-progress.interface';

/** Implemented by NotificationDeliveryService, consumed by NotificationRequestedConsumer. */
export interface INotificationDeliveryService {
  /** Skips an expired message; throwing makes the queue retry it (done addresses are skipped). */
  handle(
    message: NotificationRequestedMessage,
    progress: IDeliveryProgress,
  ): Promise<void>;
}
