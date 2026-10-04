import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IEventConsumer } from '@app/kafka-client';
import { isUserStateMessage, KAFKA_TOPICS } from '@app/kafka-contracts';
import { EVENT_CONSUMER, REMINDER_SCHEDULER } from '../../tokens';
import type { IReminderScheduler } from '../../application/interfaces/reminder-scheduler.interface';

// Event entry point: a profile changed (maybe its location) → reschedule that user's reminders.
// The location itself is read from users.profiles, so the message is only the trigger.
@Injectable()
export class UserStateConsumer implements OnModuleInit {
  constructor(
    @Inject(EVENT_CONSUMER) private readonly consumer: IEventConsumer,
    @Inject(REMINDER_SCHEDULER) private readonly scheduler: IReminderScheduler,
  ) {}

  onModuleInit(): void {
    this.consumer.subscribe(KAFKA_TOPICS.USER_STATE, isUserStateMessage, (m) =>
      this.scheduler.rescheduleUser(m.userId),
    );
  }
}
