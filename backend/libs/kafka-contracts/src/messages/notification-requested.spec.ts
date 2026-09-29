import { isNotificationRequestedMessage } from './notification-requested';

const valid = {
  notificationId: 'n-1',
  userId: 'u-1',
  title: 'Shabbat in 1h 30m',
  body: 'Candle lighting at 18:04',
  source: 'reminders',
  requestedAt: '2026-10-02T13:34:00Z',
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
  ])('rejects %s', (_name, value) => {
    expect(isNotificationRequestedMessage(value)).toBe(false);
  });
});
