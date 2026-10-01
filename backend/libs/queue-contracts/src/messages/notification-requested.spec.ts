import {
  isNotificationRequestedMessage,
  notificationRequestedPublishOptions,
} from './notification-requested';

const valid = {
  notificationId: 'n-1',
  userId: 'u-1',
  title: 'Shabbat in 1h 30m',
  body: 'Candle lighting at 18:04',
  source: 'reminders',
  requestedAt: '2026-10-02T13:34:00Z',
  expiresAt: '2026-10-02T15:04:00Z',
};

describe('isNotificationRequestedMessage', () => {
  it('accepts a minimal message and one with url/channels', () => {
    expect(isNotificationRequestedMessage(valid)).toBe(true);
    expect(
      isNotificationRequestedMessage({
        ...valid,
        url: 'https://x',
        channels: ['webpush'],
      }),
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['missing notificationId', { ...valid, notificationId: undefined }],
    ['empty userId', { ...valid, userId: '' }],
    ['non-string body', { ...valid, body: 42 }],
    ['unknown channel', { ...valid, channels: ['sms'] }],
    ['channels not an array', { ...valid, channels: 'webpush' }],
    ['unparseable requestedAt', { ...valid, requestedAt: 'yesterday' }],
    ['missing expiresAt', { ...valid, expiresAt: undefined }],
    ['unparseable expiresAt', { ...valid, expiresAt: 'soon' }],
    ['empty expiresAt', { ...valid, expiresAt: '' }],
    ['null expiresAt', { ...valid, expiresAt: null }],
    ['expiresAt as epoch millis', { ...valid, expiresAt: 1790953440000 }],
    ['expiresAt as a Date object', { ...valid, expiresAt: new Date() }],
  ])('rejects %s', (_name, value) => {
    expect(isNotificationRequestedMessage(value)).toBe(false);
  });

  it('accepts an expiresAt with a UTC offset, and one earlier than requestedAt (the consumer judges it)', () => {
    expect(
      isNotificationRequestedMessage({
        ...valid,
        expiresAt: '2026-10-02T18:04:00+03:00',
      }),
    ).toBe(true);
    expect(
      isNotificationRequestedMessage({
        ...valid,
        expiresAt: '2026-10-01T00:00:00Z',
      }),
    ).toBe(true);
  });
});

describe('notificationRequestedPublishOptions', () => {
  const msg = {
    notificationId: 'n-1',
    userId: 'u-1',
    title: 'T',
    body: 'B',
    source: 'reminders',
    requestedAt: '2026-10-02T13:34:00Z',
    expiresAt: '2026-10-02T15:04:00Z',
  };

  it('dedupes on notificationId until expiresAt and retries with backoff', () => {
    expect(
      notificationRequestedPublishOptions(
        msg,
        Date.parse('2026-10-02T13:34:00Z'),
      ),
    ).toEqual({
      dedupeId: 'n-1',
      dedupeTtlMs: 90 * 60_000,
      attempts: 8,
      backoffMs: 30_000,
    });
  });

  it('never gives BullMQ a non-positive dedupe ttl (which would silently change its semantics)', () => {
    expect(
      notificationRequestedPublishOptions(
        msg,
        Date.parse('2026-10-03T00:00:00Z'),
      ).dedupeTtlMs,
    ).toBe(1);
  });
});
