import { Inject, Injectable, Logger } from '@nestjs/common';
import { FCM_DEVICE_REPOSITORY, FCM_SENDER } from '../../tokens';
import type { IDeliveryProgress } from '../../application/interfaces/delivery-progress.interface';
import type { INotificationChannel } from '../../application/interfaces/notification-channel.interface';
import { RetryableDeliveryException } from '../../application/exceptions/retryable-delivery.exception';
import type { NotificationContent } from '../../models/notification-content';
import type { IFcmDeviceRepository } from '../interfaces/fcm-device-repository.interface';
import type { IFcmSender } from '../interfaces/fcm-sender.interface';
import { encryptForDevice } from './device-cipher';

/** Payload format version, for the app. */
const FORMAT = '1';

/** One data-only message per Android device the user has now, its content encrypted with that
 * device's key — Google only carries ciphertext. A device already marked done is skipped. */
@Injectable()
export class FcmChannel implements INotificationChannel {
  readonly name = 'fcm' as const;
  private readonly logger = new Logger(FcmChannel.name);

  constructor(
    @Inject(FCM_DEVICE_REPOSITORY)
    private readonly devices: IFcmDeviceRepository,
    @Inject(FCM_SENDER) private readonly sender: IFcmSender,
  ) {}

  async deliver(
    userId: string,
    content: NotificationContent,
    expiresAt: Date,
    progress: IDeliveryProgress,
  ): Promise<void> {
    const plain = JSON.stringify({
      ...content,
      expiresAt: expiresAt.toISOString(),
    });
    const label = content.notificationId;
    let retry = 0;

    for (const device of await this.devices.findByUserId(userId)) {
      const key = `fcm:${device.id}`;
      if (progress.isDone(key)) continue;

      const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      if (ttlSeconds <= 0) {
        this.logger.warn(`Expired before every device was reached (${label})`);
        return;
      }

      let data: Record<string, string>;
      try {
        data = { v: FORMAT, enc: encryptForDevice(plain, device.key) };
      } catch {
        this.logger.warn(
          `Device ${device.id} has an unusable key, not sent (${label})`,
        );
        await progress.markDone(key);
        continue;
      }
      const outcome = await this.sender.send(device.token, data, ttlSeconds);

      if (outcome === 'retry') {
        retry++;
        continue;
      }
      if (outcome === 'gone') {
        await this.devices.deleteById(device.id);
        this.logger.log(`Removed dead device ${device.id} (${label})`);
      } else if (outcome === 'failed') {
        this.logger.warn(`FCM to ${device.id} failed, not retried (${label})`);
      }
      await progress.markDone(key);
    }

    if (retry > 0) {
      throw new RetryableDeliveryException(
        `${retry} Android device(s) busy or unreachable (${label})`,
      );
    }
  }
}
