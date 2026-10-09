import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BullmqQueueConsumer, BullmqQueuePublisher } from '@app/queue-client';
import {
  notificationRequestedPublishOptions,
  QUEUES,
  type NotificationRequestedMessage,
} from '@app/queue-contracts';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { NotificationRequestedConsumer } from '../src/api/consumers/notification-requested.consumer';
import { NotificationDeliveryService } from '../src/application/notification-delivery.service';
import { WebPushChannel } from '../src/infrastructure/webpush/web-push.channel';
import { redisConnectionFromUrl } from '@app/queue-client';
import { InMemoryPushSubscriptionRepository } from './in-memory-push-subscription.repository';

// Opt-in, real BullMQ; empties the real queue name, so point it at a throwaway Redis only (see
// CLAUDE.md's Commands). REDIS_IT_URL=redis://127.0.0.1:6390 npx jest notification-flow.it
const url = process.env.REDIS_IT_URL;
const maybe = url ? describe : describe.skip;

maybe(
  'notification-requested → delivery (real BullMQ, fake push sender)',
  () => {
    const config = { getOrThrow: () => url } as unknown as ConfigService;
    const keys = { p256dh: 'p', auth: 'a' };
    let publisher: BullmqQueuePublisher;
    let consumer: BullmqQueueConsumer;
    let repo: InMemoryPushSubscriptionRepository;
    let send: jest.Mock;
    let queue: Queue;

    const message = (
      over: Partial<NotificationRequestedMessage> = {},
    ): NotificationRequestedMessage => ({
      notificationId: `n-${randomUUID()}`,
      userId: 'u1',
      title: 'T',
      body: 'B',
      source: 'it',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      ...over,
    });
    // The contract's options, with a short backoff so the test doesn't wait 30s.
    const request = (m: NotificationRequestedMessage) =>
      publisher.publish(QUEUES.NOTIFICATION_REQUESTED, m, {
        ...notificationRequestedPublishOptions(m),
        backoffMs: 50,
      });
    const until = async (
      cond: () => boolean | Promise<boolean>,
      ms = 10_000,
    ) => {
      const end = Date.now() + ms;
      while (!(await cond())) {
        if (Date.now() > end) throw new Error('timed out');
        await new Promise((r) => setTimeout(r, 50));
      }
    };
    const sentTo = () =>
      send.mock.calls.map(([s]) => (s as { endpoint: string }).endpoint);

    beforeEach(async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      queue = new Queue(QUEUES.NOTIFICATION_REQUESTED, {
        connection: redisConnectionFromUrl(url!),
      });
      await queue.obliterate({ force: true });
      repo = new InMemoryPushSubscriptionRepository();
      send = jest.fn().mockResolvedValue('sent');
      publisher = new BullmqQueuePublisher(config);
      consumer = new BullmqQueueConsumer(config);
      const channel = new WebPushChannel(repo, { send });
      new NotificationRequestedConsumer(
        consumer,
        new NotificationDeliveryService([channel]),
      ).onModuleInit();
      consumer.onApplicationBootstrap();
    });

    afterEach(async () => {
      await consumer.onModuleDestroy();
      await publisher.onApplicationShutdown();
      await queue.close();
      jest.restoreAllMocks();
    });

    it('retries only the busy device; the phone that already got it is never sent twice', async () => {
      await repo.upsertByEndpoint({
        userId: 'u1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/phone',
        ...keys,
      });
      await repo.upsertByEndpoint({
        userId: 'u1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/laptop',
        ...keys,
      });
      let laptopTries = 0;
      send.mockImplementation((s: { endpoint: string }) =>
        Promise.resolve(
          s.endpoint.endsWith('laptop') && ++laptopTries < 3 ? 'retry' : 'sent',
        ),
      );

      await request(message());
      await until(async () => (await queue.getCompletedCount()) === 1);

      expect(sentTo().filter((e) => e.endsWith('phone'))).toHaveLength(1);
      expect(sentTo().filter((e) => e.endsWith('laptop'))).toHaveLength(3);
    }, 20_000);

    it('gives up on a device still busy at the last attempt: the job ends failed (and is logged), the phone got it once', async () => {
      const warns: string[] = [];
      jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation((m: unknown) => void warns.push(String(m)));
      await repo.upsertByEndpoint({
        userId: 'u1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/phone',
        ...keys,
      });
      await repo.upsertByEndpoint({
        userId: 'u1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/laptop',
        ...keys,
      });
      send.mockImplementation((s: { endpoint: string }) =>
        Promise.resolve(s.endpoint.endsWith('laptop') ? 'retry' : 'sent'),
      );
      const m = message();
      await publisher.publish(QUEUES.NOTIFICATION_REQUESTED, m, {
        ...notificationRequestedPublishOptions(m),
        attempts: 3,
        backoffMs: 50,
      });
      await until(async () => (await queue.getFailedCount()) === 1);

      const [failed] = await queue.getFailed();
      expect(failed.attemptsMade).toBe(3);
      expect(sentTo().filter((e) => e.endsWith('phone'))).toHaveLength(1);
      expect(sentTo().filter((e) => e.endsWith('laptop'))).toHaveLength(3);
      // The phone stays recorded on the failed job, for whoever inspects it.
      expect(Object.keys(failed.progress as object)).toHaveLength(1);
      expect(warns.some((w) => /failed \(attempt 3, giving up\)/.test(w))).toBe(
        true,
      );
    }, 20_000);

    it('a gone device is deleted on the first attempt and not tried again while another device is retried', async () => {
      await repo.upsertByEndpoint({
        userId: 'u1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/dead',
        ...keys,
      });
      await repo.upsertByEndpoint({
        userId: 'u1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/laptop',
        ...keys,
      });
      let laptopTries = 0;
      send.mockImplementation((s: { endpoint: string }) =>
        Promise.resolve(
          s.endpoint.endsWith('dead')
            ? 'gone'
            : ++laptopTries < 2
              ? 'retry'
              : 'sent',
        ),
      );
      await request(message());
      await until(async () => (await queue.getCompletedCount()) === 1);
      expect(sentTo().filter((e) => e.endsWith('dead'))).toHaveLength(1);
      expect([...repo.rows.keys()]).toEqual([
        'https://fcm.googleapis.com/fcm/send/laptop',
      ]);
    }, 20_000);

    it('drops a second copy of the same notification (dedupe on notificationId)', async () => {
      await repo.upsertByEndpoint({
        userId: 'u1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/phone',
        ...keys,
      });
      const m = message();
      await request(m);
      await until(async () => (await queue.getCompletedCount()) === 1);
      await request(m);
      await new Promise((r) => setTimeout(r, 500));
      expect(send).toHaveBeenCalledTimes(1);
    }, 20_000);

    it('never sends an expired notification', async () => {
      await repo.upsertByEndpoint({
        userId: 'u1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/phone',
        ...keys,
      });
      await publisher.publish(
        QUEUES.NOTIFICATION_REQUESTED,
        message({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
      );
      await until(async () => (await queue.getCompletedCount()) === 1);
      expect(send).not.toHaveBeenCalled();
    }, 20_000);

    it('fails a malformed job once, without retrying it', async () => {
      await publisher.publish(
        QUEUES.NOTIFICATION_REQUESTED,
        { nope: true },
        { attempts: 5, backoffMs: 10 },
      );
      await until(async () => (await queue.getFailedCount()) === 1);
      await new Promise((r) => setTimeout(r, 300));
      const [failed] = await queue.getFailed();
      expect(failed.attemptsMade).toBe(1);
      expect(send).not.toHaveBeenCalled();
    }, 20_000);
  },
);
