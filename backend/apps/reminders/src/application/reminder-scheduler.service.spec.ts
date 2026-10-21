import type { CandleLightingDueMessage } from '@app/queue-contracts';
import { ReminderScheduler } from './reminder-scheduler.service';
import { ReminderService } from './reminder.service';
import { ShabbatCalendar } from '@app/jewish-calendar';
import { ShabbatCalendarCandleLightingSource } from '../infrastructure/calendar/shabbat-calendar.candle-lighting.source';
import type { ICandleLightingSource } from '../infrastructure/interfaces/candle-lighting-source.interface';
import type { Coordinates } from '../models/user-location';
import { FakeQueue } from '../../test/fake-queue';
import { InMemoryReminderRepository } from '../../test/in-memory-reminder.repository';

/** Friday candle lighting at 15:00 UTC minus `lon` minutes, so moving east moves it earlier. */
const fakeCalendar: ICandleLightingSource = {
  nextAfter(location: Coordinates, after: Date) {
    for (let d = 0; d <= 7; d++) {
      const day = new Date(after);
      day.setUTCDate(day.getUTCDate() + d);
      day.setUTCHours(15, -Math.round(location.lon), 0, 0);
      if (day.getUTCDay() === 5 && day > after) return Promise.resolve(day);
    }
    throw new Error('unreachable');
  },
};

const HERZLIYA: Coordinates = { lat: 32.1782, lon: 34.9076 };
const EILAT: Coordinates = { lat: 29.5577, lon: 20 }; // lon nudged for a clear shift
// Herzliya → Friday 2026-10-09 14:25 UTC (17:25 in Israel).
const CANDLES_1 = new Date('2026-10-09T14:25:00Z');
const CANDLES_2 = new Date('2026-10-16T14:25:00Z');

describe('ReminderScheduler', () => {
  let repo: InMemoryReminderRepository;
  let queue: FakeQueue<CandleLightingDueMessage>;
  let locations: Map<string, Coordinates>;
  let scheduler: ReminderScheduler;
  let service: ReminderService;

  const build = () => {
    const reader = {
      findByUserId: (id: string) => Promise.resolve(locations.get(id) ?? null),
    };
    scheduler = new ReminderScheduler(repo, reader, fakeCalendar, queue);
    service = new ReminderService(repo, reader, scheduler);
  };

  // Jest's fake clock stands in for "now" (Date and Date.now) — the scheduler just calls new Date().
  const setNow = (at: string | Date) => jest.setSystemTime(new Date(at));
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    setNow('2026-10-07T10:00:00Z'); // a Wednesday
    repo = new InMemoryReminderRepository();
    queue = new FakeQueue<CandleLightingDueMessage>();
    locations = new Map([['u1', HERZLIYA]]);
    build();
  });

  const reminder = async () => (await repo.findByUserId('u1'))[0];
  /** Moves the clock and runs every reminder-due job that's due, like a BullMQ worker. */
  const advanceTo = async (at: string | Date) => {
    setNow(at);
    for (const job of queue.pending().sort((a, b) => a.runAt - b.runAt)) {
      if (job.runAt > Date.now()) continue;
      queue.jobs.get(job.id)!.done = true;
      await scheduler.fire(job.data);
    }
  };

  it('saves the next fire time (candle lighting − offset) and queues one delayed job', async () => {
    const saved = await service.save('u1', 'shabbat_candles', {
      offsetMinutes: 90,
    });

    const fireAt = new Date(CANDLES_1.getTime() - 90 * 60_000);
    expect(saved.nextFireAt).toEqual(fireAt);
    expect((await reminder()).nextFireAt).toEqual(fireAt);
    expect(queue.pending()).toEqual([
      expect.objectContaining({
        runAt: fireAt.getTime(),
        data: {
          kind: 'shabbat_candles',
          reminderId: saved.id,
          fireAt: fireAt.toISOString(),
          candleLighting: CANDLES_1.toISOString(),
        },
      }),
    ]);
  });

  it('fires once — a second run of the same job sends nothing — and queues next week', async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
    const [job] = queue.pending();

    await advanceTo('2026-10-09T12:55:00Z');
    await scheduler.fire(job.data); // a duplicate or retried run

    expect(queue.notifications).toHaveLength(1);
    expect(queue.notifications[0]).toMatchObject({
      userId: 'u1',
      title: 'Shabbat candle lighting',
      body: 'Candle lighting is at 17:25 (in 1 h 30 min).',
      source: 'reminders',
      expiresAt: CANDLES_1.toISOString(),
    });
    const nextFireAt = new Date(CANDLES_2.getTime() - 90 * 60_000);
    expect((await reminder()).nextFireAt).toEqual(nextFireAt);
    expect(queue.pending().map((j) => j.runAt)).toEqual([nextFireAt.getTime()]);
  });

  it("words the time in Israel's clock, whatever the server's time zone", async () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
      await advanceTo('2026-10-09T12:55:00Z');
      expect(queue.notifications[0].body).toBe(
        'Candle lighting is at 17:25 (in 1 h 30 min).',
      );
    } finally {
      process.env.TZ = original;
    }
  });

  it('keeps firing every week', async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 30 });
    await advanceTo('2026-10-09T14:00:00Z');
    await advanceTo('2026-10-16T14:00:00Z');
    expect(queue.notifications.map((n) => n.expiresAt)).toEqual([
      CANDLES_1.toISOString(),
      CANDLES_2.toISOString(),
    ]);
  });

  describe('survives a restart', () => {
    beforeEach(() =>
      service.save('u1', 'shabbat_candles', { offsetMinutes: 90 }),
    );

    it('re-queues the same job when Redis lost it', async () => {
      const [before] = queue.pending();
      queue.jobs.clear();
      build(); // a fresh process over the same database
      expect(await scheduler.rescheduleAll()).toBe(0);
      expect(queue.pending()).toEqual([before]);
    });

    it("doesn't add a second job when it's still there", async () => {
      build();
      await scheduler.rescheduleAll();
      expect(queue.pending()).toHaveLength(1);
    });

    it('fires late, not never, when it was down at fire time but candle lighting is still ahead', async () => {
      queue.jobs.clear();
      setNow('2026-10-09T13:30:00Z'); // 35 min late, 55 min before candle lighting
      build();
      await scheduler.rescheduleAll();
      expect(queue.pending()[0].runAt).toBe(Date.now()); // due right away
      await advanceTo(new Date());
      expect(queue.notifications[0].body).toBe(
        'Candle lighting is at 17:25 (in 55 min).',
      );
    });
  });

  it('moves the next time when the offset changes, and the old job does nothing', async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
    const [old] = queue.pending();

    const saved = await service.save('u1', 'shabbat_candles', {
      offsetMinutes: 30,
    });

    const fireAt = new Date(CANDLES_1.getTime() - 30 * 60_000);
    expect(saved.nextFireAt).toEqual(fireAt);
    expect(queue.pending().map((j) => j.runAt)).toEqual([fireAt.getTime()]);
    setNow('2026-10-09T12:55:00Z');
    await scheduler.fire(old.data); // even if its removal had failed
    expect(queue.notifications).toEqual([]);
  });

  it('moves the next time when the location changes (users.user-state)', async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
    locations.set('u1', EILAT);

    await scheduler.rescheduleUser('u1');

    const candles = new Date('2026-10-09T14:40:00Z'); // 15:00 − 20 min
    const fireAt = new Date(candles.getTime() - 90 * 60_000);
    expect((await reminder()).nextFireAt).toEqual(fireAt);
    expect(queue.pending().map((j) => j.data.candleLighting)).toEqual([
      candles.toISOString(),
    ]);
  });

  it("doesn't fire this week's again when the profile changes between firing and candle lighting", async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
    await advanceTo('2026-10-09T12:55:00Z');
    setNow('2026-10-09T13:30:00Z');

    await scheduler.rescheduleUser('u1');
    await advanceTo(new Date());

    expect(queue.notifications).toHaveLength(1);
    expect((await reminder()).nextFireAt).toEqual(
      new Date(CANDLES_2.getTime() - 90 * 60_000),
    );
  });

  it("a newly saved reminder inside this week's window starts next week", async () => {
    setNow('2026-10-09T13:30:00Z'); // past candle lighting − 90 min
    const saved = await service.save('u1', 'shabbat_candles', {
      offsetMinutes: 90,
    });
    expect(saved.nextFireAt).toEqual(
      new Date(CANDLES_2.getTime() - 90 * 60_000),
    );
  });

  it('waits without a location, then schedules once one arrives', async () => {
    locations.clear();
    const saved = await service.save('u1', 'shabbat_candles', {
      offsetMinutes: 90,
    });
    expect(saved).toMatchObject({ nextFireAt: null, waitingForLocation: true });
    expect(queue.pending()).toEqual([]);

    locations.set('u1', HERZLIYA);
    await scheduler.rescheduleUser('u1');
    expect(queue.pending()).toHaveLength(1);
  });

  it('turning it off drops the job; a leftover job does nothing', async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
    const [job] = queue.pending();

    await service.turnOff('u1', 'shabbat_candles');

    expect(queue.pending()).toEqual([]);
    expect(await reminder()).toMatchObject({
      enabled: false,
      nextFireAt: null,
    });
    setNow('2026-10-09T12:55:00Z');
    await scheduler.fire(job.data);
    expect(queue.notifications).toEqual([]);
  });

  it('a job whose reminder is gone (account deleted) does nothing', async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
    repo.deleteUser('u1');
    await advanceTo('2026-10-09T12:55:00Z');
    expect(queue.notifications).toEqual([]);
    expect(queue.pending()).toEqual([]);
  });

  it("still notifies when next week's time can't be worked out at fire time; a sweep queues it", async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
    const [job] = queue.pending();
    const reader = {
      findByUserId: (id: string) => Promise.resolve(locations.get(id) ?? null),
    };
    const down = new ReminderScheduler(
      repo,
      reader,
      { nextAfter: () => Promise.reject(new Error('down')) },
      queue,
    );
    setNow('2026-10-09T12:55:00Z');
    queue.jobs.get(job.id)!.done = true;

    // Every BullMQ retry fails the same way, until it gives up.
    await expect(down.fire(job.data)).rejects.toThrow('down');
    await expect(down.fire(job.data)).rejects.toThrow('down');
    expect(queue.notifications).toHaveLength(1); // sent once despite the retry
    expect(queue.pending()).toEqual([]); // no next week's job yet

    setNow('2026-10-09T15:00:00Z'); // a sweep after candle lighting, now succeeding
    expect(await scheduler.rescheduleAll()).toBe(0);
    expect(queue.pending().map((j) => j.data.candleLighting)).toEqual([
      CANDLES_2.toISOString(),
    ]);
  });

  it('after candle lighting has passed, sends nothing but still queues next week', async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 90 });
    await advanceTo('2026-10-09T15:00:00Z'); // the worker was down until after candle lighting
    expect(queue.notifications).toEqual([]);
    expect((await reminder()).nextFireAt).toEqual(
      new Date(CANDLES_2.getTime() - 90 * 60_000),
    );
  });

  it("still saves the setting when the time can't be worked out; the next sweep schedules it", async () => {
    const calendar = {
      nextAfter: jest.fn().mockRejectedValue(new Error('down')),
    };
    const reader = { findByUserId: () => Promise.resolve(HERZLIYA) };
    service = new ReminderService(
      repo,
      reader,
      new ReminderScheduler(repo, reader, calendar, queue),
    );

    const saved = await service.save('u1', 'shabbat_candles', {
      offsetMinutes: 90,
    });

    expect(saved).toMatchObject({ enabled: true, nextFireAt: null });
    expect(await scheduler.rescheduleAll()).toBe(0);
    expect(queue.pending()).toHaveLength(1);
  });
});

// The real calendar under the scheduler, for a point abroad (Israel's rules anywhere).
describe('ReminderScheduler over the real ShabbatCalendar, a point abroad', () => {
  const NEW_YORK: Coordinates = { lat: 40.7128, lon: -74.006 };
  // New York, Friday 2026-10-02: candles 22:16 UTC (18:16 local, 01:16 Saturday in Israel).
  const CANDLES_NY = new Date('2026-10-02T22:16:00Z');

  let repo: InMemoryReminderRepository;
  let queue: FakeQueue<CandleLightingDueMessage>;
  let scheduler: ReminderScheduler;
  let service: ReminderService;

  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => {
    jest.setSystemTime(new Date('2026-09-30T10:00:00Z')); // a Wednesday
    repo = new InMemoryReminderRepository();
    queue = new FakeQueue<CandleLightingDueMessage>();
    const reader = { findByUserId: () => Promise.resolve(NEW_YORK) };
    const source = new ShabbatCalendarCandleLightingSource(
      new ShabbatCalendar(),
    );
    scheduler = new ReminderScheduler(repo, reader, source, queue);
    service = new ReminderService(repo, reader, scheduler);
  });

  it("schedules this Friday's local candle lighting", async () => {
    const saved = await service.save('u1', 'shabbat_candles', {
      offsetMinutes: 20,
    });
    expect(saved.nextFireAt).toEqual(
      new Date(CANDLES_NY.getTime() - 20 * 60_000),
    );
  });

  // West of Israel, this Friday's candle lighting is still ahead after Israel's midnight.
  it("a sweep after Israel's midnight keeps this Friday's pending job", async () => {
    await service.save('u1', 'shabbat_candles', { offsetMinutes: 20 });
    jest.setSystemTime(new Date('2026-10-02T21:15:00Z')); // 17:15 in New York
    await scheduler.rescheduleAll();
    expect((await repo.findByUserId('u1'))[0].nextFireAt).toEqual(
      new Date(CANDLES_NY.getTime() - 20 * 60_000),
    );
  });
});
