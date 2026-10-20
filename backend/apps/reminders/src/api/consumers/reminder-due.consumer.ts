import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IQueueConsumer } from '@app/queue-client';
import { isReminderDueMessage, QUEUES } from '@app/queue-contracts';
import {
  CUSTOM_REMINDER_SCHEDULER,
  QUEUE_CONSUMER,
  REMINDER_SCHEDULER,
} from '../../tokens';
import type { ICustomReminderScheduler } from '../../application/interfaces/custom-reminder-scheduler.interface';
import type { IReminderScheduler } from '../../application/interfaces/reminder-scheduler.interface';

// Queue entry point: a reminder's delayed `reminder-due` job → its scheduler's fire (by `kind`).
@Injectable()
export class ReminderDueConsumer implements OnModuleInit {
  constructor(
    @Inject(QUEUE_CONSUMER) private readonly consumer: IQueueConsumer,
    @Inject(REMINDER_SCHEDULER) private readonly scheduler: IReminderScheduler,
    @Inject(CUSTOM_REMINDER_SCHEDULER)
    private readonly custom: ICustomReminderScheduler,
  ) {}

  onModuleInit(): void {
    this.consumer.process(QUEUES.REMINDER_DUE, isReminderDueMessage, (m) =>
      m.kind === 'custom' ? this.custom.fire(m) : this.scheduler.fire(m),
    );
  }
}
