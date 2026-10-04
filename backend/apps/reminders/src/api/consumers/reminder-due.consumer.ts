import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IQueueConsumer } from '@app/queue-client';
import { isReminderDueMessage, QUEUES } from '@app/queue-contracts';
import { QUEUE_CONSUMER, REMINDER_SCHEDULER } from '../../tokens';
import type { IReminderScheduler } from '../../application/interfaces/reminder-scheduler.interface';

// Queue entry point: a reminder's delayed `reminder-due` job → ReminderScheduler.fire.
@Injectable()
export class ReminderDueConsumer implements OnModuleInit {
  constructor(
    @Inject(QUEUE_CONSUMER) private readonly consumer: IQueueConsumer,
    @Inject(REMINDER_SCHEDULER) private readonly scheduler: IReminderScheduler,
  ) {}

  onModuleInit(): void {
    this.consumer.process(QUEUES.REMINDER_DUE, isReminderDueMessage, (m) =>
      this.scheduler.fire(m),
    );
  }
}
