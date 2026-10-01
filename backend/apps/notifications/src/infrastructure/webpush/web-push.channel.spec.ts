import { Logger } from '@nestjs/common';
import { InMemoryDeliveryProgress } from '../../../test/in-memory-delivery-progress';
import { InMemoryPushSubscriptionRepository } from '../../../test/in-memory-push-subscription.repository';
import { RetryableDeliveryException } from '../../application/exceptions/retryable-delivery.exception';
import { WebPushChannel } from './web-push.channel';

describe('WebPushChannel', () => {
  const content = { notificationId: 'n-1', title: 'T', body: 'B' };
  const keys = { p256dh: 'p', auth: 'a' };
  let repo: InMemoryPushSubscriptionRepository;
  let progress: InMemoryDeliveryProgress;
  let send: jest.Mock;
  let channel: WebPushChannel;

  const inAnHour = () => new Date(Date.now() + 3600_000);
  const subscribe = async (endpoint: string, userId = 'u1') => {
    await repo.upsertByEndpoint({ userId, endpoint, ...keys });
    return repo.rows.get(endpoint)!.id;
  };
  const deliver = (expiresAt = inAnHour(), userId = 'u1') =>
    channel.deliver(userId, content, expiresAt, progress);
  const sentTo = () =>
    send.mock.calls.map(([s]) => (s as { endpoint: string }).endpoint);

  beforeEach(() => {
    repo = new InMemoryPushSubscriptionRepository();
    progress = new InMemoryDeliveryProgress();
    send = jest.fn().mockResolvedValue('sent');
    channel = new WebPushChannel(repo, { send });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("sends the JSON content to each of the user's devices, and only theirs, marking each done", async () => {
    const phone = await subscribe('https://fcm.googleapis.com/fcm/send/phone');
    const laptop = await subscribe(
      'https://updates.push.services.mozilla.com/wpush/v2/laptop',
    );
    await subscribe('https://fcm.googleapis.com/fcm/send/other', 'u2');

    await deliver();

    expect(sentTo()).toEqual([
      'https://fcm.googleapis.com/fcm/send/phone',
      'https://updates.push.services.mozilla.com/wpush/v2/laptop',
    ]);
    const [, payload] = send.mock.calls[0] as [unknown, string];
    expect(JSON.parse(payload)).toEqual(content);
    expect([...progress.done]).toEqual([
      `webpush:${phone}`,
      `webpush:${laptop}`,
    ]);
  });

  it('retries only the busy device: throws RetryableDeliveryException after trying all, and the retry skips the done ones', async () => {
    await subscribe('https://fcm.googleapis.com/fcm/send/phone');
    const laptop = await subscribe(
      'https://fcm.googleapis.com/fcm/send/laptop',
    );
    send.mockImplementation((s: { endpoint: string }) =>
      Promise.resolve(s.endpoint.endsWith('laptop') ? 'retry' : 'sent'),
    );

    await expect(deliver()).rejects.toBeInstanceOf(RetryableDeliveryException);
    expect(progress.isDone(`webpush:${laptop}`)).toBe(false);

    send.mockClear();
    send.mockResolvedValue('sent');
    await deliver(); // the retry
    expect(sentTo()).toEqual(['https://fcm.googleapis.com/fcm/send/laptop']);
  });

  it('keeps going to the other devices when an earlier one is busy', async () => {
    await subscribe('https://fcm.googleapis.com/fcm/send/busy');
    await subscribe('https://fcm.googleapis.com/fcm/send/ok');
    send.mockImplementation((s: { endpoint: string }) =>
      Promise.resolve(s.endpoint.endsWith('busy') ? 'retry' : 'sent'),
    );
    await expect(deliver()).rejects.toBeInstanceOf(RetryableDeliveryException);
    expect(sentTo()).toHaveLength(2);
  });

  it('on a retry, reaches a device added since and never one removed or taken over since', async () => {
    const phone = await subscribe('https://fcm.googleapis.com/fcm/send/phone');
    await subscribe('https://fcm.googleapis.com/fcm/send/shared');
    send.mockResolvedValue('retry');
    await expect(deliver()).rejects.toBeInstanceOf(RetryableDeliveryException);

    await repo.deleteById(phone); // unsubscribed
    await subscribe('https://fcm.googleapis.com/fcm/send/shared', 'u2'); // browser changed hands
    await subscribe('https://fcm.googleapis.com/fcm/send/new-laptop'); // new device
    send.mockClear();
    send.mockResolvedValue('sent');
    await deliver();

    expect(sentTo()).toEqual([
      'https://fcm.googleapis.com/fcm/send/new-laptop',
    ]);
  });

  it('deletes a subscription the push service reports gone, and marks it done', async () => {
    const id = await subscribe('https://fcm.googleapis.com/fcm/send/gone');
    send.mockResolvedValue('gone');
    await deliver();
    expect(repo.rows.size).toBe(0);
    expect(progress.isDone(`webpush:${id}`)).toBe(true);
  });

  it('when deleting a gone row fails: passes the error up, does not mark it done, and the retry tries it again', async () => {
    const dead = await subscribe('https://fcm.googleapis.com/fcm/send/dead');
    await subscribe('https://fcm.googleapis.com/fcm/send/later');
    send.mockImplementation((s: { endpoint: string }) =>
      Promise.resolve(s.endpoint.endsWith('dead') ? 'gone' : 'sent'),
    );
    jest.spyOn(repo, 'deleteById').mockRejectedValueOnce(new Error('db down'));
    await expect(deliver()).rejects.toThrow('db down');
    expect(progress.isDone(`webpush:${dead}`)).toBe(false);
    expect(sentTo()).toEqual(['https://fcm.googleapis.com/fcm/send/dead']);

    send.mockClear();
    await deliver(); // the retry: gone again (harmless), deleted this time; the other one reached
    expect(sentTo()).toEqual([
      'https://fcm.googleapis.com/fcm/send/dead',
      'https://fcm.googleapis.com/fcm/send/later',
    ]);
    expect([...repo.rows.keys()]).toEqual([
      'https://fcm.googleapis.com/fcm/send/later',
    ]);
  });

  it('still asks for a retry when one device is busy and another is gone or failed', async () => {
    const gone = await subscribe('https://fcm.googleapis.com/fcm/send/gone');
    const bad = await subscribe('https://fcm.googleapis.com/fcm/send/bad');
    const busy = await subscribe('https://fcm.googleapis.com/fcm/send/busy');
    const outcomes: Record<string, string> = {
      gone: 'gone',
      bad: 'failed',
      busy: 'retry',
    };
    send.mockImplementation((s: { endpoint: string }) =>
      Promise.resolve(outcomes[s.endpoint.split('/').pop()!]),
    );
    await expect(deliver()).rejects.toThrow(/1 device\(s\)/);
    expect(progress.isDone(`webpush:${gone}`)).toBe(true);
    expect(progress.isDone(`webpush:${bad}`)).toBe(true);
    expect(progress.isDone(`webpush:${busy}`)).toBe(false);
  });

  it('stops without asking for a retry once expiresAt passes mid-way, even after a busy device', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-02T15:03:58.000Z') });
    try {
      await subscribe('https://fcm.googleapis.com/fcm/send/busy');
      await subscribe('https://fcm.googleapis.com/fcm/send/late');
      send.mockImplementation(() => {
        jest.setSystemTime(new Date('2026-10-02T15:04:00.500Z')); // a slow push service
        return Promise.resolve('retry');
      });
      await expect(
        deliver(new Date('2026-10-02T15:04:00.000Z')),
      ).resolves.toBeUndefined();
      expect(sentTo()).toEqual(['https://fcm.googleapis.com/fcm/send/busy']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('logs a permanent failure, marks it done (not retried) and keeps the row', async () => {
    const id = await subscribe('https://fcm.googleapis.com/fcm/send/bad');
    send.mockResolvedValue('failed');
    await expect(deliver()).resolves.toBeUndefined();
    expect(progress.isDone(`webpush:${id}`)).toBe(true);
    expect(repo.rows.size).toBe(1);
  });

  it.each([
    ['outside the allowlist', 'https://evil.example.com/x'],
    [
      'a host url.parse reads differently',
      'https://evil.example;.fcm.googleapis.com/x',
    ],
    ["one url.parse can't read", 'https://a%@fcm.googleapis.com/x'],
  ])(
    'never sends to an endpoint %s, and removes that row',
    async (_n, endpoint) => {
      await subscribe(endpoint);
      await subscribe('https://fcm.googleapis.com/fcm/send/good');
      await deliver();
      expect(sentTo()).toEqual(['https://fcm.googleapis.com/fcm/send/good']);
      expect([...repo.rows.keys()]).toEqual([
        'https://fcm.googleapis.com/fcm/send/good',
      ]);
    },
  );

  it('passes a DB error up (so the job is retried) without marking anything done', async () => {
    jest.spyOn(repo, 'findByUserId').mockRejectedValue(new Error('db down'));
    await expect(deliver()).rejects.toThrow('db down');
    expect(progress.done.size).toBe(0);
  });

  it('passes a progress-save error up before moving on (the retry may repeat that one device)', async () => {
    await subscribe('https://fcm.googleapis.com/fcm/send/a');
    await subscribe('https://fcm.googleapis.com/fcm/send/b');
    jest
      .spyOn(progress, 'markDone')
      .mockRejectedValueOnce(new Error('redis down'));
    await expect(deliver()).rejects.toThrow('redis down');
    expect(sentTo()).toEqual(['https://fcm.googleapis.com/fcm/send/a']);
  });

  it('gives the push service a TTL of the whole seconds left until expiresAt', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-02T13:34:00.000Z') });
    try {
      await subscribe('https://fcm.googleapis.com/fcm/send/phone');
      await deliver(new Date('2026-10-02T15:04:00.999Z'));
      const [, , ttl] = send.mock.calls[0] as [unknown, unknown, number];
      expect(ttl).toBe(90 * 60);
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends nothing once less than a second is left (e.g. a late retry)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-02T15:03:59.200Z') });
    try {
      await subscribe('https://fcm.googleapis.com/fcm/send/phone');
      await expect(
        deliver(new Date('2026-10-02T15:04:00.000Z')),
      ).resolves.toBeUndefined();
      expect(send).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
