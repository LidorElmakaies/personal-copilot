import { QUEUES, reminderDuePublishOptions } from '@app/queue-contracts';
import type { ReminderDueMessage } from '@app/queue-contracts';
import { ReminderJobCleaner } from './reminder-job-cleaner.service';
import { FakeQueue } from '../../test/fake-queue';
import { InMemoryCustomReminderRepository } from '../../test/in-memory-custom-reminder.repository';
import { InMemoryReminderRepository } from '../../test/in-memory-reminder.repository';

describe('ReminderJobCleaner', () => {
  const FIRE_AT = '2026-10-23T14:00:00.000Z';
  let reminders: InMemoryReminderRepository;
  let customReminders: InMemoryCustomReminderRepository;
  let queue: FakeQueue;
  let cleaner: ReminderJobCleaner;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-21T10:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    reminders = new InMemoryReminderRepository();
    customReminders = new InMemoryCustomReminderRepository();
    queue = new FakeQueue();
    cleaner = new ReminderJobCleaner(queue, reminders, customReminders);
  });

  const enqueue = (message: ReminderDueMessage) =>
    queue.publish(
      QUEUES.REMINDER_DUE,
      message,
      reminderDuePublishOptions(message),
    );
  const candleJob = (reminderId: string) =>
    enqueue({
      kind: 'shabbat_candles',
      reminderId,
      fireAt: FIRE_AT,
      candleLighting: FIRE_AT,
    });
  const customJob = (reminderId: string) =>
    enqueue({ kind: 'custom', reminderId, fireAt: FIRE_AT });
  const addCustom = (userId: string) =>
    customReminders.create(userId, {
      title: 'Call Grandma',
      hour: 8,
      minute: 0,
      repeat: 'daily',
      calendar: 'gregorian',
      start: '2026-10-21',
    });
  const queuedIds = () => queue.pending().map((j) => j.data.reminderId);

  it("removes a deleted account's jobs of both kinds and keeps everyone else's", async () => {
    const goneCandle = await reminders.upsertEnabled(
      'gone',
      'shabbat_candles',
      { offsetMinutes: 30 },
    );
    const goneCustom = await addCustom('gone');
    const keptCandle = await reminders.upsertEnabled(
      'kept',
      'shabbat_candles',
      { offsetMinutes: 30 },
    );
    const keptCustom = await addCustom('kept');
    for (const id of [goneCandle.id, keptCandle.id]) await candleJob(id);
    for (const id of [goneCustom.id, keptCustom.id]) await customJob(id);

    reminders.deleteUser('gone');
    customReminders.deleteUser('gone');

    expect(await cleaner.removeOrphans()).toBe(2);
    expect(queuedIds().sort()).toEqual([keptCandle.id, keptCustom.id].sort());
  });

  it('checks each kind against its own table', async () => {
    const candle = await reminders.upsertEnabled('u1', 'shabbat_candles', {
      offsetMinutes: 30,
    });
    await customJob(candle.id); // a custom job naming a candle reminder's id: no custom row

    expect(await cleaner.removeOrphans()).toBe(1);
    expect(queuedIds()).toEqual([]);
  });

  it('treats a candle job without `kind` (queued before it was set) as a candle job', async () => {
    const candle = await reminders.upsertEnabled('u1', 'shabbat_candles', {
      offsetMinutes: 30,
    });
    await enqueue({
      reminderId: candle.id,
      fireAt: FIRE_AT,
      candleLighting: FIRE_AT,
    });
    await enqueue({
      reminderId: 'deleted',
      fireAt: FIRE_AT,
      candleLighting: FIRE_AT,
    });

    expect(await cleaner.removeOrphans()).toBe(1);
    expect(queuedIds()).toEqual([candle.id]);
  });

  it("leaves a job alone whose data isn't a reminder-due message", async () => {
    await queue.publish(
      QUEUES.REMINDER_DUE,
      { junk: true },
      { jobId: 'junk', delayMs: 60_000 },
    );

    expect(await cleaner.removeOrphans()).toBe(0);
    expect(queue.jobs.has('junk')).toBe(true);
  });

  it('removes nothing when there are no delayed jobs', async () => {
    expect(await cleaner.removeOrphans()).toBe(0);
  });
});
