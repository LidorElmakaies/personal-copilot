import type { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { BullmqQueueConsumer } from '../src/bullmq-queue-consumer';
import { BullmqQueuePublisher } from '../src/bullmq-queue-publisher';
import type { JobMeta } from '../src/queue-consumer.interface';
import { redisConnectionFromUrl } from '../src/redis-connection';

// Opt-in: needs a real Redis. REDIS_IT_URL=redis://localhost:6379 npx jest queue-roundtrip
const url = process.env.REDIS_IT_URL;
const maybe = url ? describe : describe.skip;

maybe('publisher → Redis → consumer (real BullMQ)', () => {
  const config = { getOrThrow: () => url } as unknown as ConfigService;
  const isMsg = (v: unknown): v is { n: number } =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { n?: unknown }).n === 'number';
  let publisher: BullmqQueuePublisher;
  let consumer: BullmqQueueConsumer;

  afterEach(async () => {
    await consumer?.onModuleDestroy();
    await publisher?.onApplicationShutdown();
  });

  const start = (
    queue: string,
    handler: (m: { n: number }) => Promise<void>,
  ) => {
    publisher = new BullmqQueuePublisher(config);
    consumer = new BullmqQueueConsumer(config);
    consumer.process(queue, isMsg, handler);
    consumer.onApplicationBootstrap();
  };
  const until = async (cond: () => boolean, ms = 10_000) => {
    const end = Date.now() + ms;
    while (!cond()) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  it('delivers a job, and drops a second one with the same dedupe id', async () => {
    const queue = `it-${randomUUID()}`;
    const seen: number[] = [];
    start(queue, (m) => Promise.resolve(void seen.push(m.n)));
    await publisher.publish(
      queue,
      { n: 1 },
      { dedupeId: 'same', dedupeTtlMs: 60_000 },
    );
    await publisher.publish(
      queue,
      { n: 2 },
      { dedupeId: 'same', dedupeTtlMs: 60_000 },
    );
    await until(() => seen.length >= 1);
    await new Promise((r) => setTimeout(r, 500));
    expect(seen).toEqual([1]);
  }, 20_000);

  it('retries a failing handler until it succeeds', async () => {
    const queue = `it-${randomUUID()}`;
    let calls = 0;
    start(queue, () =>
      ++calls < 3 ? Promise.reject(new Error('flaky')) : Promise.resolve(),
    );
    await publisher.publish(queue, { n: 1 }, { attempts: 3, backoffMs: 50 });
    await until(() => calls === 3);
    expect(calls).toBe(3);
  }, 20_000);

  it('never retries malformed data', async () => {
    const queue = `it-${randomUUID()}`;
    const handler = jest.fn().mockResolvedValue(undefined);
    start(queue, handler);
    await publisher.publish(
      queue,
      { n: 'not a number' },
      { attempts: 5, backoffMs: 10 },
    );
    await new Promise((r) => setTimeout(r, 1000));
    expect(handler).not.toHaveBeenCalled();
  }, 20_000);

  it('holds a delayed job until its time', async () => {
    const queue = `it-${randomUUID()}`;
    const at: number[] = [];
    start(queue, () => Promise.resolve(void at.push(Date.now())));
    const sent = Date.now();
    await publisher.publish(queue, { n: 1 }, { delayMs: 1500 });
    await until(() => at.length === 1);
    expect(at[0] - sent).toBeGreaterThanOrEqual(1400);
  }, 20_000);

  it('keeps saved progress across retries', async () => {
    const queue = `it-${randomUUID()}`;
    const seenOnAttempt: Record<string, unknown>[] = [];
    publisher = new BullmqQueuePublisher(config);
    consumer = new BullmqQueueConsumer(config);
    consumer.process(queue, isMsg, async (_m, meta) => {
      seenOnAttempt.push({ ...meta.progress });
      if (meta.attempt === 1) {
        await meta.saveProgress({ done: 'a' });
        throw new Error('fail after saving');
      }
    });
    consumer.onApplicationBootstrap();
    await publisher.publish(queue, { n: 1 }, { attempts: 2, backoffMs: 50 });
    await until(() => seenOnAttempt.length === 2);
    expect(seenOnAttempt).toEqual([{}, { done: 'a' }]);
  }, 20_000);

  // A worker that dies mid-job (crash, OOM kill, deploy) leaves the job active; BullMQ's stalled
  // check moves it back to wait. The retry must still see what the dead attempt saved, or it
  // resends to every device that already got the notification.
  it("keeps saved progress when a crashed worker's job is recovered as stalled", async () => {
    const queue = `it-${randomUUID()}`;
    const connection = redisConnectionFromUrl(url!);
    publisher = new BullmqQueuePublisher(config);
    // Only for its run(); its own Workers are never started.
    consumer = new BullmqQueueConsumer(config);
    const seen: Pick<JobMeta, 'attempt' | 'progress'>[] = [];
    let saved = false;
    const route = {
      isValid: isMsg as (v: unknown) => boolean,
      concurrency: 1,
      handler: async (_d: unknown, meta: JobMeta) => {
        seen.push({ attempt: meta.attempt, progress: { ...meta.progress } });
        if (seen.length === 1) {
          await meta.saveProgress({ 'webpush:a': true });
          saved = true;
          await new Promise(() => undefined); // hangs until the "crash"
        }
      },
    };
    const opts = { connection, lockDuration: 1000, stalledInterval: 300 };
    const crashing = new Worker(queue, (job) => consumer.run(route, job), opts);
    await publisher.publish(queue, { n: 1 }, { attempts: 3, backoffMs: 50 });
    await until(() => saved);
    await crashing.close(true); // stops renewing the lock, like a dead process

    const rescuer = new Worker(queue, (job) => consumer.run(route, job), opts);
    try {
      await until(() => seen.length === 2);
      expect(seen[1].progress).toEqual({ 'webpush:a': true });
      // A stall isn't a failed attempt: BullMQ doesn't count it, so the attempt number repeats.
      expect(seen[1].attempt).toBe(1);
    } finally {
      await rescuer.close();
    }
  }, 20_000);
});
