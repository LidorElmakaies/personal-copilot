import type { ConfigService } from '@nestjs/config';
import {
  BullmqQueueConsumer,
  type IQueueConsumer,
  type JobMeta,
} from '@app/queue-client';
import type { Job } from 'bullmq';
import { isNotificationRequestedMessage } from '@app/queue-contracts';
import type { IDeliveryProgress } from '../../application/interfaces/delivery-progress.interface';
import { NotificationRequestedConsumer } from './notification-requested.consumer';

describe('NotificationRequestedConsumer', () => {
  it("routes validated jobs to NotificationDeliveryService, backing progress with the job's own", async () => {
    const processFn = jest.fn();
    const handle = jest.fn().mockResolvedValue(undefined);
    new NotificationRequestedConsumer(
      { process: processFn } as IQueueConsumer,
      { handle },
    ).onModuleInit();

    const [queue, guard, handler, options] = processFn.mock.calls[0] as [
      string,
      unknown,
      (m: unknown, meta: JobMeta) => Promise<void>,
      { concurrency: number },
    ];
    expect(queue).toBe('notification-requested');
    expect(guard).toBe(isNotificationRequestedMessage);
    expect(options.concurrency).toBeGreaterThan(1);

    const saveProgress = jest.fn().mockResolvedValue(undefined);
    await handler(
      { notificationId: 'n-1' },
      {
        queue,
        jobId: 'j',
        attempt: 2,
        attemptsAllowed: 8,
        progress: { 'webpush:a': true },
        saveProgress,
      },
    );
    const [, progress] = handle.mock.calls[0] as [unknown, IDeliveryProgress];
    expect(progress.isDone('webpush:a')).toBe(true);
    expect(progress.isDone('webpush:b')).toBe(false);
    await progress.markDone('webpush:b');
    expect(saveProgress).toHaveBeenCalledWith({ 'webpush:b': true });
  });

  // Through BullmqQueueConsumer.run with a job shaped like BullMQ's, instead of a hand-made JobMeta.
  describe("over a real BullmqQueueConsumer.run and BullMQ's job progress", () => {
    const valid = {
      notificationId: 'n-1',
      userId: 'u1',
      title: 'T',
      body: 'B',
      source: 'reminders',
      requestedAt: '2026-10-02T13:34:00Z',
      expiresAt: '2026-10-02T15:04:00Z',
    };
    const runWith = async (
      jobProgress: unknown,
      use: (p: IDeliveryProgress) => Promise<void>,
      updateProgress = jest.fn().mockResolvedValue(undefined),
    ) => {
      let handler!: (d: unknown, m: JobMeta) => Promise<void>;
      const bull = new BullmqQueueConsumer({
        getOrThrow: () => 'redis://localhost:6379',
      } as unknown as ConfigService);
      jest
        .spyOn(bull, 'process')
        .mockImplementation((_q, _g, h) => void (handler = h as never));
      new NotificationRequestedConsumer(bull, {
        handle: (_m, p) => use(p),
      }).onModuleInit();
      const job = {
        id: '7',
        queueName: 'notification-requested',
        data: valid,
        attemptsMade: 0,
        opts: { attempts: 8 },
        progress: jobProgress,
        updateProgress,
      } as unknown as Job;
      await bull.run(
        {
          isValid: isNotificationRequestedMessage,
          handler: handler,
          concurrency: 5,
        },
        job,
      );
      return updateProgress;
    };

    it("treats BullMQ's initial numeric progress (0) as nothing done", async () => {
      await runWith(0, (p) => {
        expect(p.isDone('webpush:a')).toBe(false);
        return Promise.resolve();
      });
    });

    it('only counts a key saved as `true` as done', async () => {
      await runWith({ 'webpush:a': 'true', 'webpush:b': 1 }, (p) => {
        expect(p.isDone('webpush:a')).toBe(false);
        expect(p.isDone('webpush:b')).toBe(false);
        return Promise.resolve();
      });
    });

    it("persists every key marked so far on each save, keeping earlier attempts' ones", async () => {
      const update = await runWith({ 'webpush:a': true }, async (p) => {
        await p.markDone('webpush:b');
        expect(p.isDone('webpush:b')).toBe(true);
        await p.markDone('webpush:c');
      });
      expect(update.mock.calls).toEqual([
        [{ 'webpush:a': true, 'webpush:b': true }],
        [{ 'webpush:a': true, 'webpush:b': true, 'webpush:c': true }],
      ]);
    });

    it('rejects markDone when Redis rejects the save (the caller must not move on as if saved)', async () => {
      await expect(
        runWith(
          0,
          (p) => p.markDone('webpush:a'),
          jest.fn().mockRejectedValue(new Error('redis down')),
        ),
      ).rejects.toThrow('redis down');
    });
  });
});
