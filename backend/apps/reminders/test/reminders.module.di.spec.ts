import { ConfigModule } from '@nestjs/config';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { Provider, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersProfileEntity, UsersUserEntity } from '@app/users-schema';
import { ReminderDueConsumer } from '../src/api/consumers/reminder-due.consumer';
import { UserStateConsumer } from '../src/api/consumers/user-state.consumer';
import { ReminderSweeper } from '../src/api/schedulers/reminder-sweeper';
import { CustomReminderScheduler } from '../src/application/custom-reminder-scheduler.service';
import { CustomReminderEntity } from '../src/entities/custom-reminder.entity';
import { ReminderEntity } from '../src/entities/reminder.entity';
import { RemindersModule } from '../src/reminders.module';
import {
  CUSTOM_REMINDER_REPOSITORY,
  CUSTOM_REMINDER_SCHEDULER,
  EVENT_CONSUMER,
  QUEUE_CONSUMER,
  QUEUE_PUBLISHER,
  REMINDER_OCCURRENCES,
  USER_LOCATION_READER,
} from '../src/tokens';

// RemindersModule's own providers and controllers, wired by Nest: only what reaches outside the
// process (Postgres, Redis, Kafka) is replaced. Compiled, not initialised — nothing subscribes.
describe('RemindersModule wiring', () => {
  const EXTERNAL = new Set<unknown>([
    QUEUE_PUBLISHER,
    QUEUE_CONSUMER,
    EVENT_CONSUMER,
  ]);
  const own = <T>(key: string) =>
    (Reflect.getMetadata(key, RemindersModule) ?? []) as T[];

  const compile = () =>
    Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
      controllers: own<Type>(MODULE_METADATA.CONTROLLERS),
      providers: [
        ...own<Provider>(MODULE_METADATA.PROVIDERS).filter(
          (p) => !('provide' in p && EXTERNAL.has(p.provide)),
        ),
        ...[...EXTERNAL].map((provide) => ({
          provide: provide as symbol,
          useValue: {},
        })),
        ...[
          ReminderEntity,
          CustomReminderEntity,
          UsersUserEntity,
          UsersProfileEntity,
        ].map((e) => ({ provide: getRepositoryToken(e), useValue: {} })),
      ],
    }).compile();

  it('resolves every provider and controller', async () => {
    const ref = await compile();
    expect(ref.get(CUSTOM_REMINDER_SCHEDULER)).toBeInstanceOf(
      CustomReminderScheduler,
    );
    for (const cls of [ReminderDueConsumer, UserStateConsumer, ReminderSweeper])
      expect(ref.get(cls)).toBeInstanceOf(cls);
    await ref.close();
  });

  it('CustomReminderScheduler injects no location reader (Israel-only)', () => {
    const params = Reflect.getMetadata(
      'self:paramtypes',
      CustomReminderScheduler,
    ) as Array<{ param: unknown }>;
    expect(
      params
        .map((p) => p.param)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(
      [CUSTOM_REMINDER_REPOSITORY, QUEUE_PUBLISHER, REMINDER_OCCURRENCES].sort(
        (a, b) => String(a).localeCompare(String(b)),
      ),
    );
    expect(params.map((p) => p.param)).not.toContain(USER_LOCATION_READER);
  });
});
