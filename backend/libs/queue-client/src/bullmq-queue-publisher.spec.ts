import type { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { BullmqQueuePublisher } from './bullmq-queue-publisher';

describe('BullmqQueuePublisher.publish', () => {
  const config = {
    getOrThrow: () => 'redis://localhost:6379',
  } as unknown as ConfigService;
  let add: jest.SpyInstance;

  beforeEach(() => {
    add = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('maps options to BullMQ job options', async () => {
    const pub = new BullmqQueuePublisher(config);
    await pub.publish(
      'q',
      { a: 1 },
      {
        jobId: 'r-1_1700000000000',
        dedupeId: 'n-1',
        dedupeTtlMs: 5000,
        delayMs: 60_000,
        attempts: 4,
        backoffMs: 1000,
      },
    );
    expect(add).toHaveBeenCalledWith(
      'q',
      { a: 1 },
      expect.objectContaining({
        jobId: 'r-1_1700000000000',
        deduplication: { id: 'n-1', ttl: 5000 },
        delay: 60_000,
        attempts: 4,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
    await pub.onApplicationShutdown();
  });

  it('defaults to one attempt, no dedupe, no delay, and bounded retention', async () => {
    const pub = new BullmqQueuePublisher(config);
    await pub.publish('q', { a: 1 });
    const [, , opts] = add.mock.calls[0] as [
      string,
      unknown,
      Record<string, unknown>,
    ];
    expect(opts).toMatchObject({
      attempts: 1,
      deduplication: undefined,
      delay: undefined,
      backoff: undefined,
    });
    expect(typeof (opts.removeOnComplete as { age: unknown }).age).toBe(
      'number',
    );
    expect(typeof (opts.removeOnFail as { age: unknown }).age).toBe('number');
    await pub.onApplicationShutdown();
  });
});
