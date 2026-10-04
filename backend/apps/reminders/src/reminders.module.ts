import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShabbatCalendar } from '@app/jewish-calendar';
import { KafkajsEventConsumer } from '@app/kafka-client';
import { KAFKA_CONSUMER_GROUPS } from '@app/kafka-contracts';
import { BullmqQueueConsumer, BullmqQueuePublisher } from '@app/queue-client';
import { ReminderDueConsumer } from './api/consumers/reminder-due.consumer';
import { UserStateConsumer } from './api/consumers/user-state.consumer';
import { HealthController } from './api/controllers/health.controller';
import { RemindersController } from './api/controllers/reminders.controller';
import { ReminderSweeper } from './api/schedulers/reminder-sweeper';
import { ReminderScheduler } from './application/reminder-scheduler.service';
import { ReminderService } from './application/reminder.service';
import { ReminderEntity } from './entities/reminder.entity';
import { UsersProfileEntity, UsersUserEntity } from '@app/users-schema';
import { ShabbatCalendarCandleLightingSource } from './infrastructure/calendar/shabbat-calendar.candle-lighting.source';
import { TypeOrmReminderRepository } from './infrastructure/postgres/typeorm-reminder.repository';
import { TypeOrmUserLocationReader } from './infrastructure/postgres/typeorm-user-location.reader';
import {
  CANDLE_LIGHTING_SOURCE,
  EVENT_CONSUMER,
  QUEUE_CONSUMER,
  QUEUE_PUBLISHER,
  REMINDER_REPOSITORY,
  REMINDER_SCHEDULER,
  REMINDER_SERVICE,
  SHABBAT_CALENDAR,
  USER_LOCATION_READER,
} from './tokens';

// UsersUserEntity/UsersProfileEntity map the Users Service's tables read-only (synchronize: false).
const ENTITIES = [ReminderEntity, UsersUserEntity, UsersProfileEntity];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        // This service's own schema in the shared database — the only one it writes.
        schema: 'reminders',
        entities: ENTITIES,
        // Same policy as Users — see backend/apps/users/README.md's "synchronize: true below production".
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [HealthController, RemindersController],
  providers: [
    { provide: REMINDER_SERVICE, useClass: ReminderService },
    { provide: REMINDER_SCHEDULER, useClass: ReminderScheduler },
    { provide: REMINDER_REPOSITORY, useClass: TypeOrmReminderRepository },
    { provide: USER_LOCATION_READER, useClass: TypeOrmUserLocationReader },
    { provide: SHABBAT_CALENDAR, useValue: new ShabbatCalendar() },
    {
      provide: CANDLE_LIGHTING_SOURCE,
      useClass: ShabbatCalendarCandleLightingSource,
    },
    {
      provide: QUEUE_PUBLISHER,
      useFactory: (config: ConfigService) => new BullmqQueuePublisher(config),
      inject: [ConfigService],
    },
    {
      provide: QUEUE_CONSUMER,
      useFactory: (config: ConfigService) => new BullmqQueueConsumer(config),
      inject: [ConfigService],
    },
    {
      provide: EVENT_CONSUMER,
      useFactory: (config: ConfigService) =>
        new KafkajsEventConsumer(
          config,
          'reminders',
          KAFKA_CONSUMER_GROUPS.REMINDERS,
        ),
      inject: [ConfigService],
    },
    ReminderDueConsumer,
    UserStateConsumer,
    ReminderSweeper,
  ],
})
export class RemindersModule {}
