import type { ConfigService } from '@nestjs/config';
import { UnrecoverableError, type Job } from 'bullmq';
import { BullmqQueueConsumer } from './bullmq-queue-consumer';

describe('BullmqQueueConsumer.run', () => {
  const config = {
    getOrThrow: () => 'redis://localhost:6379',
  } as unknown as ConfigService;
  const isThing = (v: unknown): v is { n: number } =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { n?: unknown }).n === 'number';
  const job = (
    data: unknown,
    attemptsMade = 0,
    attempts = 3,
    progress: unknown = 0,
  ) =>
    ({
      id: 'j-1',
      queueName: 'q',
      data,
      attemptsMade,
      opts: { attempts },
      progress,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    }) as unknown as Job & { updateProgress: jest.Mock };

  const route = (handler: jest.Mock) => ({
    isValid: isThing,
    handler,
    concurrency: 1,
  });

  it('hands valid data and job meta to the handler', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    await new BullmqQueueConsumer(config).run(
      route(handler),
      job({ n: 1 }, 1, 3),
    );
    expect(handler).toHaveBeenCalledWith(
      { n: 1 },
      expect.objectContaining({
        queue: 'q',
        jobId: 'j-1',
        attempt: 2,
        attemptsAllowed: 3,
        progress: {},
      }),
    );
  });

  it("exposes earlier attempts' progress and merges saves into the job's progress", async () => {
    const updateProgress = jest.fn().mockResolvedValue(undefined);
    const j = {
      ...job({ n: 1 }, 1, 3, { 'webpush:a': true }),
      updateProgress,
    } as unknown as Job;
    let seen: Record<string, unknown> = {};
    await new BullmqQueueConsumer(config).run(
      route(
        jest.fn(
          async (
            _d,
            meta: {
              progress: Record<string, unknown>;
              saveProgress: (p: Record<string, unknown>) => Promise<void>;
            },
          ) => {
            seen = { ...meta.progress };
            await meta.saveProgress({ 'webpush:b': true });
            await meta.saveProgress({ 'webpush:c': true });
          },
        ),
      ),
      j,
    );
    expect(seen).toEqual({ 'webpush:a': true });
    expect(updateProgress).toHaveBeenLastCalledWith({
      'webpush:a': true,
      'webpush:b': true,
      'webpush:c': true,
    });
  });

  it('fails malformed data with UnrecoverableError (never retried) without calling the handler', async () => {
    const handler = jest.fn();
    await expect(
      new BullmqQueueConsumer(config).run(route(handler), job({ n: 'x' })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('lets a handler error through, so BullMQ retries while attempts remain', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const err = await new BullmqQueueConsumer(config)
      .run(route(handler), job({ n: 1 }))
      .catch((e: unknown) => e);
    expect(err).toEqual(new Error('boom'));
    expect(err).not.toBeInstanceOf(UnrecoverableError);
  });

  it('requires REDIS_URL', () => {
    const missing = {
      getOrThrow: () => {
        throw new Error('REDIS_URL missing');
      },
    } as unknown as ConfigService;
    expect(() => new BullmqQueueConsumer(missing)).toThrow('REDIS_URL');
  });
});
