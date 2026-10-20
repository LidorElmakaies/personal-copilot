// Subpath, not the package root: see libs/jewish-calendar's hebcal-calendar.calculator.ts.
import { HDate, months } from '@hebcal/core/dist/esm/index';
import { ReminderOccurrences } from '@app/jewish-calendar';
import type { PublishOptions } from '@app/queue-client';
import type { CustomReminderDueMessage } from '@app/queue-contracts';
import {
  CustomReminderScheduler,
  LATE_LIMIT_MS,
} from './custom-reminder-scheduler.service';
import { CustomReminderService } from './custom-reminder.service';
import type { CustomReminderInput } from '../models/custom-reminder';
import { FakeQueue } from '../../test/fake-queue';
import { InMemoryCustomReminderRepository } from '../../test/in-memory-custom-reminder.repository';

/** An instant as 'YYYY-MM-DD HH:MM' wall-clock time in Israel — what the user set. */
const local = (at: Date | number | null) =>
  at === null
    ? null
    : new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(at);
/** A Hebrew date's civil day, 'YYYY-MM-DD'. */
const civilOf = (hd: HDate) => {
  const d = hd.greg();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe('CustomReminderScheduler', () => {
  let repo: InMemoryCustomReminderRepository;
  let queue: FakeQueue<CustomReminderDueMessage>;
  let scheduler: CustomReminderScheduler;
  let service: CustomReminderService;

  // Jest's fake clock stands in for "now" (Date and Date.now) — the scheduler just calls new Date().
  const setNow = (at: string | Date) => jest.setSystemTime(new Date(at));
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    setNow('2026-10-20T10:00:00Z'); // Tuesday 13:00 in Israel
    repo = new InMemoryCustomReminderRepository();
    queue = new FakeQueue<CustomReminderDueMessage>();
    const occurrences = new ReminderOccurrences();
    scheduler = new CustomReminderScheduler(repo, occurrences, queue);
    service = new CustomReminderService(repo, occurrences, scheduler);
  });

  const add = (input: Partial<CustomReminderInput> = {}) =>
    service.create('u1', {
      title: 'Call Grandma',
      hour: 8,
      minute: 0,
      repeat: 'daily',
      calendar: 'gregorian',
      start: '2026-10-20',
      ...input,
    });
  const stored = async (id: string) => (await repo.findById(id))!;
  const pendingAt = () =>
    queue
      .pending()
      .sort((a, b) => a.runAt - b.runAt)
      .map((j) => local(j.runAt));
  /** Moves the clock and runs every reminder-due job that's due, like a BullMQ worker. */
  const advanceTo = async (at: string | Date) => {
    setNow(at);
    for (const job of queue.pending().sort((a, b) => a.runAt - b.runAt)) {
      if (job.runAt > Date.now()) continue;
      queue.jobs.get(job.id)!.done = true;
      await scheduler.fire(job.data);
    }
  };

  it('queues a once-reminder at its time in Israel, with the job kind custom', async () => {
    const r = await add({
      repeat: 'once',
      start: '2026-10-21',
      hour: 19,
      minute: 30,
    });

    const fireAt = new Date('2026-10-21T16:30:00Z'); // 19:30 in Israel (UTC+3)
    expect(r.nextFireAt).toEqual(fireAt);
    expect((await stored(r.id)).nextFireAt).toEqual(fireAt);
    expect(queue.pending()).toEqual([
      expect.objectContaining({
        runAt: fireAt.getTime(),
        data: {
          kind: 'custom',
          reminderId: r.id,
          fireAt: fireAt.toISOString(),
        },
      }),
    ]);
  });

  it('fires a once-reminder once: notification with its title, then done but kept', async () => {
    const r = await add({
      repeat: 'once',
      start: '2026-10-21',
      hour: 19,
      minute: 30,
    });

    await advanceTo('2026-10-21T16:30:00Z');

    expect(queue.notifications).toEqual([
      expect.objectContaining({
        notificationId: `custom-reminder-${r.id}-${Date.parse('2026-10-21T16:30:00Z')}`,
        userId: 'u1',
        title: 'Call Grandma',
        body: 'Your reminder for 19:30.',
        url: '/calendar',
        source: 'reminders',
        expiresAt: new Date(
          Date.parse('2026-10-21T16:30:00Z') + LATE_LIMIT_MS,
        ).toISOString(),
      }),
    ]);
    expect(queue.pending()).toEqual([]);
    expect((await stored(r.id)).nextFireAt).toBeNull();

    await scheduler.rescheduleAll(); // the sweep leaves it done
    expect(queue.pending()).toEqual([]);
  });

  it('never queues a once-reminder whose time has passed', async () => {
    const r = await add({ repeat: 'once', start: '2026-10-20', hour: 9 });
    expect(r.nextFireAt).toBeNull();
    expect(queue.pending()).toEqual([]);
  });

  it('daily: today’s time has passed → tomorrow; after firing, the day after', async () => {
    await add({ hour: 8 });
    expect(pendingAt()).toEqual(['2026-10-21 08:00']);

    await advanceTo('2026-10-21T05:00:00Z');
    expect(queue.notifications).toHaveLength(1);
    expect(pendingAt()).toEqual(['2026-10-22 08:00']);
  });

  it('a duplicate or retried run sends one notification and queues one next job', async () => {
    await add({ hour: 8 });
    const [job] = queue.pending();
    await advanceTo('2026-10-21T05:00:00Z');
    await scheduler.fire(job.data); // moved on already: a no-op
    expect(queue.notifications).toHaveLength(1);
    expect(pendingAt()).toEqual(['2026-10-22 08:00']);
  });

  it('monthly, Gregorian: the 31st falls on a shorter month’s last day', async () => {
    await add({ repeat: 'monthly', start: '2026-01-31', hour: 9 });
    // 31 October is after Israel's clocks go back (25 October): still 09:00 local.
    expect(pendingAt()).toEqual(['2026-10-31 09:00']);

    await advanceTo('2026-10-31T07:00:00Z');
    expect(pendingAt()).toEqual(['2026-11-30 09:00']);
  });

  it('monthly, Hebrew: the same Hebrew day of the next month', async () => {
    const start = civilOf(new HDate(1, months.CHESHVAN, 5787));
    await add({ repeat: 'monthly', calendar: 'hebrew', start, hour: 9 });
    expect(pendingAt()).toEqual([
      `${civilOf(new HDate(1, months.KISLEV, 5787))} 09:00`,
    ]);
  });

  it('yearly, Gregorian: 29 February falls on the 28th in a regular year', async () => {
    await add({ repeat: 'yearly', start: '2024-02-29', hour: 9 });
    expect(pendingAt()).toEqual(['2027-02-28 09:00']);
  });

  it('yearly, Hebrew: next year on the same Hebrew date', async () => {
    const start = civilOf(new HDate(1, months.CHESHVAN, 5787));
    await add({ repeat: 'yearly', calendar: 'hebrew', start, hour: 9 });
    expect(pendingAt()).toEqual([
      `${civilOf(new HDate(1, months.CHESHVAN, 5788))} 09:00`,
    ]);
  });

  it('an edit moves the job: the old one is removed', async () => {
    const r = await add({ hour: 8 });
    await service.update('u1', r.id, { hour: 18, minute: 15 });
    expect(pendingAt()).toEqual(['2026-10-20 18:15']); // still ahead today
    expect((await stored(r.id)).nextFireAt).toEqual(
      new Date('2026-10-20T15:15:00Z'),
    );
  });

  it('a delete removes the job; a leftover one does nothing', async () => {
    const r = await add({ hour: 8 });
    const [job] = queue.pending();
    await service.remove('u1', r.id);
    expect(queue.pending()).toEqual([]);

    await scheduler.fire(job.data); // even if its removal had failed
    expect(queue.notifications).toEqual([]);
    expect(queue.pending()).toEqual([]);
  });

  it('skipping the next date moves the job on; skipping a later one leaves it', async () => {
    const r = await add({ hour: 8 });
    await service.skip('u1', r.id, '2026-10-21');
    expect(pendingAt()).toEqual(['2026-10-22 08:00']);

    await service.skip('u1', r.id, '2026-10-25');
    expect(pendingAt()).toEqual(['2026-10-22 08:00']);

    await advanceTo('2026-10-22T05:00:00Z');
    await advanceTo('2026-10-23T05:00:00Z');
    await advanceTo('2026-10-24T05:00:00Z');
    expect(pendingAt()).toEqual(['2026-10-26 08:00']); // the 25th never queued
    expect(queue.notifications).toHaveLength(3);
  });

  it('a skipped once-reminder is never queued', async () => {
    const r = await add({ repeat: 'once', start: '2026-10-21' });
    await service.skip('u1', r.id, '2026-10-21');
    expect(queue.pending()).toEqual([]);
    expect((await stored(r.id)).nextFireAt).toBeNull();
  });

  it('is queued in Israel time with no location needed (the app is Israel-only)', async () => {
    const r = await add({ hour: 8 }); // the user has never sent a location
    expect(r.nextFireAt).toEqual(new Date('2026-10-21T05:00:00Z')); // 08:00 at UTC+3
  });

  it('the sweep puts back a lost job, and changes nothing otherwise', async () => {
    await add({ hour: 8 });
    const [job] = queue.pending();
    queue.jobs.delete(job.id); // Redis lost it

    expect(await scheduler.rescheduleAll()).toBe(0);
    expect(queue.pending()).toEqual([job]);
    expect(await scheduler.rescheduleAll()).toBe(0);
    expect(queue.pending()).toEqual([job]);
  });

  it('a firing missed while the service was down still fires late, when the sweep runs first', async () => {
    const r = await add({ hour: 8 });
    setNow('2026-10-21T05:20:00Z'); // 20 min past, the job hasn't run
    await scheduler.rescheduleAll();
    expect((await stored(r.id)).nextFireAt).toEqual(
      new Date('2026-10-21T05:00:00Z'),
    );

    await advanceTo('2026-10-21T05:20:00Z');
    expect(queue.notifications).toHaveLength(1);
    expect(pendingAt()).toEqual(['2026-10-22 08:00']);
  });

  it('a firing over an hour late is dropped, and the next one ahead is queued', async () => {
    await add({ hour: 8 });
    await advanceTo('2026-10-23T12:00:00Z'); // down for days

    expect(queue.notifications).toEqual([]);
    expect(pendingAt()).toEqual(['2026-10-24 08:00']);
  });

  it('a failing queue doesn’t lose the saved reminder; the sweep queues it later', async () => {
    const publish = jest
      .spyOn(queue, 'publish')
      .mockRejectedValueOnce(new Error('redis down'));
    const r = await add({ hour: 8 });
    expect(await repo.findById(r.id)).not.toBeNull();
    expect(queue.pending()).toEqual([]);

    publish.mockRestore();
    await scheduler.rescheduleAll();
    expect(pendingAt()).toEqual(['2026-10-21 08:00']);
  });
  describe('clock changes (Israel: back on 25 Oct 2026, forward on 26 Mar 2027)', () => {
    it('a daily reminder stays at its wall-clock time across the clocks going back', async () => {
      await add({ hour: 8, start: '2026-10-24' });
      await advanceTo('2026-10-24T05:00:00Z'); // 08:00 at UTC+3
      expect(queue.notifications).toHaveLength(1);
      expect(queue.pending().map((j) => j.data.fireAt)).toEqual([
        '2026-10-25T06:00:00.000Z', // 08:00 at UTC+2
      ]);
      await advanceTo('2026-10-25T06:00:00Z');
      expect(queue.notifications).toHaveLength(2);
      expect(pendingAt()).toEqual(['2026-10-26 08:00']);
    });

    it('a daily reminder stays at its wall-clock time across the clocks going forward', async () => {
      setNow('2027-03-25T10:00:00Z');
      await add({ hour: 8, start: '2027-03-25' });
      expect(queue.pending().map((j) => j.data.fireAt)).toEqual([
        '2027-03-26T05:00:00.000Z', // 08:00 at UTC+3, the first day of summer time
      ]);
    });

    it('a time that happens twice (01:30 as the clocks go back) fires once that day', async () => {
      await add({ hour: 1, minute: 30, start: '2026-10-24' });
      await advanceTo('2026-10-24T22:30:00Z'); // 01:30 on the 25th, first time (UTC+3)
      await advanceTo('2026-10-24T23:30:00Z'); // 01:30 again (UTC+2)
      await advanceTo('2026-10-25T12:00:00Z');
      expect(queue.notifications).toHaveLength(1);
      expect(pendingAt()).toEqual(['2026-10-26 01:30']);
    });

    it('a time skipped by the clocks going forward (02:30) fires an hour later, not never', async () => {
      setNow('2027-03-25T10:00:00Z');
      await add({ repeat: 'once', start: '2027-03-26', hour: 2, minute: 30 });
      expect(pendingAt()).toEqual(['2027-03-26 03:30']);
      await advanceTo('2027-03-26T00:30:00Z');
      expect(queue.notifications).toHaveLength(1);
    });
  });

  describe('the late limit’s boundary (LATE_LIMIT_MS)', () => {
    const missed = async () => {
      const r = await add({ hour: 8 });
      const [job] = queue.pending();
      queue.jobs.delete(job.id); // never ran, and gone from Redis (the service was down)
      return { r, fireAt: Date.parse(job.data.fireAt) };
    };

    it('a sweep 1 ms inside the limit keeps the missed firing, and it still notifies', async () => {
      const { r, fireAt } = await missed();
      setNow(new Date(fireAt + LATE_LIMIT_MS - 1));
      await scheduler.rescheduleAll();
      expect((await stored(r.id)).nextFireAt).toEqual(new Date(fireAt));
      expect(queue.pending().map((j) => j.runAt)).toEqual([Date.now()]);

      await advanceTo(new Date(fireAt + LATE_LIMIT_MS - 1));
      expect(queue.notifications).toHaveLength(1);
      expect(queue.notifications[0].expiresAt).toBe(
        new Date(fireAt + LATE_LIMIT_MS).toISOString(),
      );
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
    });

    it('a sweep at exactly the limit moves on: same cut-off as fire(), no notification', async () => {
      const { r, fireAt } = await missed();
      setNow(new Date(fireAt + LATE_LIMIT_MS));
      await scheduler.rescheduleAll();
      expect((await stored(r.id)).nextFireAt).toEqual(
        new Date('2026-10-22T05:00:00Z'),
      );
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
      await advanceTo(new Date(fireAt + LATE_LIMIT_MS));
      expect(queue.notifications).toEqual([]);
    });

    it('a missed once-reminder past the limit is done (nothing queued, next_fire_at null)', async () => {
      const r = await add({ repeat: 'once', start: '2026-10-21', hour: 8 });
      const [job] = queue.pending();
      queue.jobs.delete(job.id);
      setNow(new Date(Date.parse(job.data.fireAt) + LATE_LIMIT_MS));
      await scheduler.rescheduleAll();
      expect((await stored(r.id)).nextFireAt).toBeNull();
      expect(queue.pending()).toEqual([]);
      expect(queue.notifications).toEqual([]);
    });

    it('a missed firing since skipped isn’t kept, even inside the limit', async () => {
      const r = await add({ hour: 8 });
      setNow('2026-10-21T05:10:00Z');
      // Skip saved straight to the row (e.g. by a past request whose rescheduling failed).
      await repo.update('u1', r.id, { skipped: ['2026-10-21'] });
      await scheduler.rescheduleAll();
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
    });
  });

  describe('notification body: the time in Israel, whatever the offset', () => {
    const bodyFor = async (start: string, hour: number, minute = 0) => {
      await add({ repeat: 'once', start, hour, minute });
      const [job] = queue.pending();
      await advanceTo(new Date(Date.parse(job.data.fireAt)));
      return queue.notifications.at(-1)!.body;
    };

    it('the day before the clocks go back (UTC+3)', async () => {
      expect(await bodyFor('2026-10-24', 8)).toBe('Your reminder for 08:00.');
      expect(queue.notifications[0].notificationId).toMatch(
        new RegExp(`-${Date.parse('2026-10-24T05:00:00Z')}$`),
      );
    });

    it('the day the clocks go back, after the change (UTC+2)', async () => {
      expect(await bodyFor('2026-10-25', 8)).toBe('Your reminder for 08:00.');
      expect(queue.notifications[0].expiresAt).toBe(
        new Date(
          Date.parse('2026-10-25T06:00:00Z') + LATE_LIMIT_MS,
        ).toISOString(),
      );
    });

    it('just before midnight after the change: still the same Israel time, not UTC’s', async () => {
      expect(await bodyFor('2026-10-26', 23, 45)).toBe(
        'Your reminder for 23:45.',
      ); // 21:45 UTC
    });

    it('a repeated 01:30 (the clocks going back) reads 01:30', async () => {
      expect(await bodyFor('2026-10-25', 1, 30)).toBe(
        'Your reminder for 01:30.',
      );
    });
  });

  describe('retries and races', () => {
    it('fails after the notification (next job not queued): the retry sends no second one and queues the next', async () => {
      const r = await add({ hour: 8 });
      const [job] = queue.pending();
      queue.jobs.get(job.id)!.done = true; // running
      setNow('2026-10-21T05:00:00Z');
      const realPublish = queue.publish.bind(queue) as FakeQueue['publish'];
      const publish = jest
        .spyOn(queue, 'publish')
        .mockImplementation((q: string, data: object, o?: PublishOptions) =>
          (data as { kind?: string }).kind === 'custom'
            ? Promise.reject(new Error('redis down'))
            : realPublish(q, data, o),
        );
      await expect(scheduler.fire(job.data)).rejects.toThrow('redis down');
      expect(queue.notifications).toHaveLength(1);
      expect((await stored(r.id)).nextFireAt).toEqual(
        new Date(job.data.fireAt),
      ); // untouched, so the retry still matches

      publish.mockRestore();
      setNow('2026-10-21T05:00:30Z'); // BullMQ's first retry
      await scheduler.fire(job.data);
      expect(queue.notifications).toHaveLength(1);
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
      expect((await stored(r.id)).nextFireAt).toEqual(
        new Date('2026-10-22T05:00:00Z'),
      );
    });

    it('fails saving next_fire_at after queueing the next job: the retry is harmless', async () => {
      await add({ hour: 8 });
      const [job] = queue.pending();
      queue.jobs.get(job.id)!.done = true; // running
      setNow('2026-10-21T05:00:00Z');
      jest
        .spyOn(repo, 'setNextFireAt')
        .mockRejectedValueOnce(new Error('db down'));
      await expect(scheduler.fire(job.data)).rejects.toThrow('db down');
      setNow('2026-10-21T05:00:30Z');
      await scheduler.fire(job.data);
      expect(queue.notifications).toHaveLength(1);
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
    });

    it('a retry over an hour late still queues the next one, without a notification', async () => {
      await add({ hour: 8 });
      const [job] = queue.pending();
      queue.jobs.get(job.id)!.done = true; // running
      setNow(new Date(Date.parse(job.data.fireAt) + LATE_LIMIT_MS)); // exactly the limit
      await scheduler.fire(job.data);
      expect(queue.notifications).toEqual([]);
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
    });

    it('a job run late (worker down, job kept in Redis) within the hour still notifies', async () => {
      await add({ hour: 8 });
      await advanceTo('2026-10-21T05:40:00Z');
      expect(queue.notifications).toHaveLength(1);
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
    });

    it('an edit landing while a firing runs is put right by the next sweep', async () => {
      const r = await add({ hour: 8 });
      const [job] = queue.pending();
      queue.jobs.get(job.id)!.done = true; // running
      setNow('2026-10-21T05:00:00Z');
      // The firing reads the reminder, then the user moves it to 18:00 before the firing saves.
      const realFind = repo.findById.bind(repo) as typeof repo.findById;
      jest.spyOn(repo, 'findById').mockImplementationOnce(async (id) => {
        const before = await realFind(id);
        await service.update('u1', r.id, { hour: 18 });
        return before;
      });
      await scheduler.fire(job.data);

      await scheduler.rescheduleAll();
      expect(pendingAt()).toEqual(['2026-10-21 18:00']);
      expect((await stored(r.id)).nextFireAt).toEqual(
        new Date('2026-10-21T15:00:00Z'),
      );
    });

    it('a title-only edit keeps the queued job as it is', async () => {
      const r = await add({ hour: 8 });
      const [job] = queue.pending();
      const remove = jest.spyOn(queue, 'remove');
      await service.update('u1', r.id, { title: 'Call Grandpa' });
      expect(remove).not.toHaveBeenCalled();
      expect(queue.pending()).toEqual([job]);

      await advanceTo('2026-10-21T05:00:00Z');
      expect(queue.notifications[0].title).toBe('Call Grandpa'); // read at firing time
    });

    it('a once-reminder already done is queued again when moved to a later day', async () => {
      const r = await add({ repeat: 'once', start: '2026-10-21', hour: 8 });
      await advanceTo('2026-10-21T05:00:00Z');
      expect((await stored(r.id)).nextFireAt).toBeNull();

      await service.update('u1', r.id, { start: '2026-10-30' });
      expect(pendingAt()).toEqual(['2026-10-30 08:00']);
    });

    it('skipping a firing missed while the service was down moves on rather than firing it late', async () => {
      const r = await add({ hour: 8 });
      setNow('2026-10-21T05:20:00Z'); // the 21st's 08:00 job hasn't run yet
      await service.skip('u1', r.id, '2026-10-21');
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
      await advanceTo('2026-10-21T05:20:00Z');
      expect(queue.notifications).toEqual([]);
    });

    it('delete still succeeds when the queued job can’t be removed', async () => {
      const r = await add({ hour: 8 });
      jest
        .spyOn(queue, 'remove')
        .mockRejectedValueOnce(new Error('redis down'));
      await expect(service.remove('u1', r.id)).resolves.toBeUndefined();
      expect(await repo.findById(r.id)).toBeNull();
    });

    // A failed job stays in Redis (removeOnFail: 7 days) under its id, so re-adding it would do nothing.
    it('a firing whose job failed every attempt doesn’t stop later ones (the sweep moves on)', async () => {
      const r = await add({ hour: 8 });
      const [job] = queue.pending();
      setNow('2026-10-21T05:00:00Z');
      queue.jobs.get(job.id)!.done = true; // failed for good, still kept in Redis under its id
      expect((await stored(r.id)).nextFireAt).toEqual(
        new Date(job.data.fireAt),
      );

      setNow('2026-10-21T10:00:00Z'); // a later sweep, hours on
      await scheduler.rescheduleAll();
      expect(pendingAt()).toEqual(['2026-10-22 08:00']);
    });
  });
});
