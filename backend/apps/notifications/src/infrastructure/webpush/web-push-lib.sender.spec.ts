import { createECDH, randomBytes } from 'crypto';
import https from 'https';
import { Logger } from '@nestjs/common';
import webpush, { WebPushError } from 'web-push';
import { WebPushLibSender } from './web-push-lib.sender';

// Keys that pass the subscribe DTO (base64url, within length) but that web-push can't encrypt to.
// The wire-level behaviour is in test/web-push-encryption.spec.ts.
describe('WebPushLibSender with unusable keys', () => {
  const sender = new WebPushLibSender({
    ...webpush.generateVAPIDKeys(),
    subject: 'mailto:push@personal-copilot.invalid',
  });
  const phone = createECDH('prime256v1');
  phone.generateKeys();
  const good = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: phone.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };

  let request: jest.SpyInstance;
  beforeEach(() => {
    request = jest.spyOn(https, 'request').mockImplementation(() => {
      throw new Error('no network in this test');
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['a p256dh of the wrong length', { ...good, p256dh: 'AAAA' }],
    ['an auth secret too short', { ...good, auth: 'AA' }],
  ])("reports 'failed' for %s — never throws, never sends", async (_n, sub) => {
    await expect(sender.send(sub, '{"t":1}', 3600)).resolves.toBe('failed');
    expect(request).not.toHaveBeenCalled();
  });
});

describe('WebPushLibSender outcome classification', () => {
  const sender = new WebPushLibSender({
    ...webpush.generateVAPIDKeys(),
    subject: 'mailto:push@personal-copilot.invalid',
  });
  const sub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'p',
    auth: 'a',
  };
  const httpError = (status: number) =>
    new WebPushError(
      'Received unexpected response code',
      status,
      {},
      '',
      sub.endpoint,
    );
  const withCode = (code: string) =>
    Object.assign(new Error(`connect ${code}`), { code });
  let sendNotification: jest.SpyInstance;

  beforeEach(() => {
    sendNotification = jest.spyOn(webpush, 'sendNotification');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("reports 'sent' and passes aes128gcm, the TTL, VAPID and a timeout", async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    await expect(sender.send(sub, '{"t":1}', 42)).resolves.toBe('sent');
    const [target, payload, options] = sendNotification.mock.calls[0] as [
      unknown,
      string,
      Record<string, unknown>,
    ];
    expect(target).toEqual({
      endpoint: sub.endpoint,
      keys: { p256dh: 'p', auth: 'a' },
    });
    expect(payload).toBe('{"t":1}');
    expect(options).toMatchObject({ contentEncoding: 'aes128gcm', TTL: 42 });
    expect(options.vapidDetails).toHaveProperty('privateKey');
    expect(typeof options.timeout).toBe('number');
  });

  it.each([
    [404, 'gone'],
    [410, 'gone'],
    [429, 'retry'],
    [500, 'retry'],
    [502, 'retry'],
    [503, 'retry'],
    [400, 'failed'],
    [401, 'failed'],
    [403, 'failed'],
    [413, 'failed'],
  ])('HTTP %i → %s', async (status, outcome) => {
    sendNotification.mockRejectedValue(httpError(status));
    await expect(sender.send(sub, '{}', 60)).resolves.toBe(outcome);
  });

  it.each([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
  ])("a network error (%s, no response) → 'retry'", async (code) => {
    sendNotification.mockRejectedValue(withCode(code));
    await expect(sender.send(sub, '{}', 60)).resolves.toBe('retry');
  });

  it("web-push's own request timeout → 'retry'", async () => {
    sendNotification.mockRejectedValue(new Error('Socket timeout'));
    await expect(sender.send(sub, '{}', 60)).resolves.toBe('retry');
  });

  it("any other thrown error → 'failed', never a throw", async () => {
    sendNotification.mockRejectedValue(new Error('something else'));
    await expect(sender.send(sub, '{}', 60)).resolves.toBe('failed');
    sendNotification.mockRejectedValue('not even an Error');
    await expect(sender.send(sub, '{}', 60)).resolves.toBe('failed');
  });

  it('never logs the payload', async () => {
    const lines: string[] = [];
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((m: unknown) => void lines.push(String(m)));
    sendNotification.mockRejectedValue(httpError(500));
    await sender.send(sub, '{"body":"secret-body"}', 60);
    expect(lines.join('\n')).not.toContain('secret-body');
  });
});

describe('WebPushLibSender with a p256dh that is 65 bytes but not a P-256 point', () => {
  // Node's crypto throws ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY for this key (it passes the subscribe DTO);
  // that's permanent, so it must not be retried like a network error.
  it("reports 'failed' (not 'retry') and never sends", async () => {
    const request = jest.spyOn(https, 'request').mockImplementation(() => {
      throw new Error('no network in this test');
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const offCurve = Buffer.alloc(65, 1);
      offCurve[0] = 0x04; // uncompressed-point prefix, but (1,1…) is not on the curve
      const sender = new WebPushLibSender({
        ...webpush.generateVAPIDKeys(),
        subject: 'mailto:push@personal-copilot.invalid',
      });
      const outcome = await sender.send(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
          p256dh: offCurve.toString('base64url'),
          auth: randomBytes(16).toString('base64url'),
        },
        '{}',
        60,
      );
      expect(request).not.toHaveBeenCalled();
      expect(outcome).toBe('failed');
    } finally {
      jest.restoreAllMocks();
    }
  });
});
