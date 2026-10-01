import { Logger } from '@nestjs/common';
import type {
  NotificationChannel,
  NotificationRequestedMessage,
} from '@app/queue-contracts';
import { InMemoryDeliveryProgress } from '../../test/in-memory-delivery-progress';
import type { INotificationChannel } from './interfaces/notification-channel.interface';
import { NotificationDeliveryService } from './notification-delivery.service';
import { RetryableDeliveryException } from './exceptions/retryable-delivery.exception';

describe('NotificationDeliveryService', () => {
  const message = (
    over: Partial<NotificationRequestedMessage> = {},
  ): NotificationRequestedMessage => ({
    notificationId: 'n-1',
    userId: 'u1',
    title: 'Candle lighting in 1h 30m',
    body: '18:12',
    url: '/',
    source: 'reminders',
    requestedAt: '2026-10-02T13:42:00.000Z',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ...over,
  });
  let deliver: jest.Mock;
  let progress: InMemoryDeliveryProgress;
  let service: NotificationDeliveryService;
  let warns: string[];

  const channel = (name: string, fn: jest.Mock): INotificationChannel => ({
    name: name as NotificationChannel,
    deliver: fn,
  });

  beforeEach(() => {
    deliver = jest.fn().mockResolvedValue(undefined);
    progress = new InMemoryDeliveryProgress();
    service = new NotificationDeliveryService([channel('webpush', deliver)]);
    warns = [];
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((m: unknown) => void warns.push(String(m)));
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("hands the content, expiry and the job's progress to every channel when none are named", async () => {
    const m = message();
    await service.handle(m, progress);
    expect(deliver).toHaveBeenCalledWith(
      'u1',
      { notificationId: 'n-1', title: m.title, body: m.body, url: '/' },
      new Date(m.expiresAt),
      progress,
    );
  });

  it('uses a channel the message names, and skips ones it does not', async () => {
    await service.handle(message({ channels: ['webpush'] }), progress);
    await service.handle(message({ channels: [] }), progress);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('skips an expired message (e.g. the service was down past candle lighting)', async () => {
    await service.handle(
      message({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
      progress,
    );
    expect(deliver).not.toHaveBeenCalled();
    expect(warns.join('\n')).toMatch(/Skipping n-1: expired/);
  });

  it('treats a message expiring right now as expired', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-02T15:04:00.000Z') });
    try {
      await service.handle(
        message({ expiresAt: '2026-10-02T15:04:00.000Z' }),
        progress,
      );
      expect(deliver).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('lets every channel run before rethrowing the first error, so the queue retries', async () => {
    const other = jest.fn().mockResolvedValue(undefined);
    service = new NotificationDeliveryService([
      channel('webpush', deliver),
      channel('email', other),
    ]);
    deliver.mockRejectedValue(new RetryableDeliveryException('busy'));
    await expect(service.handle(message(), progress)).rejects.toBeInstanceOf(
      RetryableDeliveryException,
    );
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('rethrows the first channel\'s error, not a later one, and logs no "Delivered"', async () => {
    const logs: string[] = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((m: unknown) => void logs.push(String(m)));
    const first = new RetryableDeliveryException('webpush busy');
    const other = jest.fn().mockRejectedValue(new Error('email down'));
    service = new NotificationDeliveryService([
      channel('webpush', deliver),
      channel('email', other),
    ]);
    deliver.mockRejectedValue(first);
    await expect(service.handle(message(), progress)).rejects.toBe(first);
    expect(other).toHaveBeenCalledTimes(1);
    expect(logs.join('\n')).not.toMatch(/Delivered/);
  });

  it('still fails the job (so it is retried) when only a later channel throws', async () => {
    const other = jest.fn().mockRejectedValue(new Error('email down'));
    service = new NotificationDeliveryService([
      channel('webpush', deliver),
      channel('email', other),
    ]);
    await expect(service.handle(message(), progress)).rejects.toThrow(
      'email down',
    );
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('wraps a non-Error rejection in an Error, so the queue still retries with a message', async () => {
    deliver.mockRejectedValue('socket hang up');
    const err = await service
      .handle(message(), progress)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('socket hang up');
  });

  it("never writes the notification's title or body to the logs", async () => {
    const lines: string[] = [];
    const capture = (m: unknown) => void lines.push(String(m));
    jest.spyOn(Logger.prototype, 'log').mockImplementation(capture);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(capture);
    await service.handle(message(), progress);
    await service.handle(
      message({ expiresAt: new Date(0).toISOString() }),
      progress,
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain('Candle lighting');
      expect(line).not.toContain('18:12');
    }
  });
});
