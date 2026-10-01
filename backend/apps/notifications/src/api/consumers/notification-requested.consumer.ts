import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IQueueConsumer } from '@app/queue-client';
import { isNotificationRequestedMessage, QUEUES } from '@app/queue-contracts';
import { NOTIFICATION_DELIVERY_SERVICE, QUEUE_CONSUMER } from '../../tokens';
import type { INotificationDeliveryService } from '../../application/interfaces/notification-delivery-service.interface';

// Queue entry point: `notification-requested` → NotificationDeliveryService, with the job's progress.
@Injectable()
export class NotificationRequestedConsumer implements OnModuleInit {
  constructor(
    @Inject(QUEUE_CONSUMER) private readonly consumer: IQueueConsumer,
    @Inject(NOTIFICATION_DELIVERY_SERVICE)
    private readonly delivery: INotificationDeliveryService,
  ) {}

  onModuleInit(): void {
    this.consumer.process(
      QUEUES.NOTIFICATION_REQUESTED,
      isNotificationRequestedMessage,
      (message, job) =>
        this.delivery.handle(message, {
          isDone: (key) => job.progress[key] === true,
          markDone: (key) => job.saveProgress({ [key]: true }),
        }),
      { concurrency: 5 },
    );
  }
}
