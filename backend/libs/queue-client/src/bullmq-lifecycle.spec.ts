import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BullmqQueueConsumer } from './bullmq-queue-consumer';
import { BullmqQueuePublisher } from './bullmq-queue-publisher';

// Worker/Queue wiring and shutdown, with BullMQ's classes replaced (no Redis).
const workers: FakeWorker[] = [];
const queues: FakeQueue[] = [];
class FakeWorker {
  listeners = new Map<string, (...a: unknown[]) => void>();
  close = jest.fn().mockResolvedValue(undefined);
  constructor(
    public name: string,
    public processor: unknown,
    public opts: Record<string, unknown>,
  ) {
    workers.push(this);
  }
  on(event: string, fn: (...a: unknown[]) => void) {
    this.listeners.set(event, fn);
    return this;
  }
}
class FakeQueue {
  add = jest.fn().mockResolvedValue({});
  close = jest.fn().mockResolvedValue(undefined);
  constructor(
    public name: string,
    public opts: Record<string, unknown>,
  ) {
    queues.push(this);
  }
}
jest.mock('bullmq', () => ({
  ...jest.requireActual<object>('bullmq'),
  Worker: jest.fn(
    (...a: [string, unknown, Record<string, unknown>]) => new FakeWorker(...a),
  ),
  Queue: jest.fn(
    (...a: [string, Record<string, unknown>]) => new FakeQueue(...a),
  ),
}));

describe('BullMQ lifecycle', () => {
  const config = {
    getOrThrow: () => 'redis://:pw@redis:6380/1',
  } as unknown as ConfigService;
  const any = (v: unknown): v is unknown => v !== undefined;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    workers.length = 0;
    queues.length = 0;
  });

  afterEach(() => jest.restoreAllMocks());

  it('starts no Worker before bootstrap, then one per queue with its concurrency and the REDIS_URL connection', () => {
    const consumer = new BullmqQueueConsumer(config);
    consumer.process('a', any, () => Promise.resolve());
    consumer.process('b', any, () => Promise.resolve(), { concurrency: 5 });
    expect(workers).toHaveLength(0);

    consumer.onApplicationBootstrap();
    expect(workers.map((w) => [w.name, w.opts.concurrency])).toEqual([
      ['a', 1],
      ['b', 5],
    ]);
    expect(workers[0].opts.connection).toMatchObject({
      host: 'redis',
      port: 6380,
      password: 'pw',
      db: 1,
    });
  });

  it("listens for each Worker's 'error' (an unhandled one would crash the process) and 'failed'", () => {
    const consumer = new BullmqQueueConsumer(config);
    consumer.process('a', any, () => Promise.resolve());
    consumer.onApplicationBootstrap();
    expect([...workers[0].listeners.keys()].sort()).toEqual([
      'error',
      'failed',
    ]);
    expect(() =>
      workers[0].listeners.get('error')!(new Error('ECONNREFUSED')),
    ).not.toThrow();
  });

  it('closes every Worker on shutdown', async () => {
    const consumer = new BullmqQueueConsumer(config);
    consumer.process('a', any, () => Promise.resolve());
    consumer.process('b', any, () => Promise.resolve());
    consumer.onApplicationBootstrap();
    await consumer.onModuleDestroy();
    for (const w of workers) expect(w.close).toHaveBeenCalledTimes(1);
  });

  it('reuses one Queue per name, and closes each on shutdown', async () => {
    const publisher = new BullmqQueuePublisher(config);
    await publisher.publish('a', { n: 1 });
    await publisher.publish('a', { n: 2 });
    await publisher.publish('b', { n: 3 });
    expect(queues.map((q) => q.name)).toEqual(['a', 'b']);
    expect(queues[0].add).toHaveBeenCalledTimes(2);
    await publisher.onApplicationShutdown();
    for (const q of queues) expect(q.close).toHaveBeenCalledTimes(1);
  });
});
