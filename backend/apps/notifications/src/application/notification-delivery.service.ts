import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationRequestedMessage } from '@app/queue-contracts';
import { NOTIFICATION_CHANNELS } from '../tokens';
import type { IDeliveryProgress } from './interfaces/delivery-progress.interface';
import type { INotificationChannel } from './interfaces/notification-channel.interface';
import type { INotificationDeliveryService } from './interfaces/notification-delivery-service.interface';

@Injectable()
export class NotificationDeliveryService implements INotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: INotificationChannel[],
  ) {}

  async handle(
    message: NotificationRequestedMessage,
    progress: IDeliveryProgress,
  ): Promise<void> {
    const id = message.notificationId;
    const expiresAt = new Date(message.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      this.logger.warn(`Skipping ${id}: expired at ${message.expiresAt}`);
      return;
    }

    const content = {
      notificationId: id,
      title: message.title,
      body: message.body,
      url: message.url,
    };
    // Every channel gets its turn even if one asks for a retry; the retry skips what's done.
    let retryError: Error | null = null;
    for (const channel of this.channels) {
      if (message.channels && !message.channels.includes(channel.name)) {
        continue;
      }
      try {
        await channel.deliver(message.userId, content, expiresAt, progress);
      } catch (err) {
        retryError ??= err instanceof Error ? err : new Error(String(err));
      }
    }
    if (retryError) throw retryError;
    this.logger.log(`Delivered ${id} from ${message.source}`);
  }
}
