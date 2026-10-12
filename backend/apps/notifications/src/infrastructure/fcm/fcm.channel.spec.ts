import { Logger } from '@nestjs/common';
import { createDecipheriv, randomBytes } from 'crypto';
import { InMemoryDeliveryProgress } from '../../../test/in-memory-delivery-progress';
import { InMemoryFcmDeviceRepository } from '../../../test/in-memory-fcm-device.repository';
import { RetryableDeliveryException } from '../../application/exceptions/retryable-delivery.exception';
import { FcmChannel } from './fcm.channel';

/** What the Android app does: iv (12) | ciphertext | tag (16), AES-256-GCM. */
function decrypt(enc: string, keyBase64: string): unknown {
  const blob = Buffer.from(enc, 'base64');
  const d = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(keyBase64, 'base64'),
    blob.subarray(0, 12),
  );
  d.setAuthTag(blob.subarray(blob.length - 16));
  return JSON.parse(
    Buffer.concat([
      d.update(blob.subarray(12, blob.length - 16)),
      d.final(),
    ]).toString('utf8'),
  );
}

describe('FcmChannel', () => {
  const content = {
    notificationId: 'n-1',
    title: 'Shabbat in 1h',
    body: 'Candle lighting at 18:04',
    url: '/',
  };
  let repo: InMemoryFcmDeviceRepository;
  let progress: InMemoryDeliveryProgress;
  let send: jest.Mock;
  let channel: FcmChannel;

  const inAnHour = () => new Date(Date.now() + 3600_000);
  const newKey = () => randomBytes(32).toString('base64');
  const register = async (token: string, userId = 'u1', key = newKey()) => {
    await repo.upsertByToken({ userId, token, key });
    return { id: repo.rows.get(token)!.id, key };
  };
  const deliver = (expiresAt = inAnHour(), userId = 'u1') =>
    channel.deliver(userId, content, expiresAt, progress);
  const sentTo = () => send.mock.calls.map(([token]) => token as string);
  const dataSentTo = (token: string) =>
    (
      send.mock.calls.find(([t]) => t === token) as [
        string,
        Record<string, string>,
        number,
      ]
    )[1];

  beforeEach(() => {
    repo = new InMemoryFcmDeviceRepository();
    progress = new InMemoryDeliveryProgress();
    send = jest.fn().mockResolvedValue('sent');
    channel = new FcmChannel(repo, { send });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("sends to each of the user's devices, and only theirs, marking each done", async () => {
    const phone = await register('tok-phone');
    const tablet = await register('tok-tablet');
    await register('tok-other', 'u2');

    await deliver();

    expect(sentTo()).toEqual(['tok-phone', 'tok-tablet']);
    expect([...progress.done]).toEqual([`fcm:${phone.id}`, `fcm:${tablet.id}`]);
  });

  it("carries only ciphertext, which only that device's key opens", async () => {
    const phone = await register('tok-phone');
    const tablet = await register('tok-tablet');
    const expiresAt = inAnHour();

    await deliver(expiresAt);

    const data = dataSentTo('tok-phone');
    expect(Object.keys(data).sort()).toEqual(['enc', 'v']);
    expect(data.v).toBe('1');
    expect(JSON.stringify(data)).not.toMatch(/Shabbat|Candle|n-1/);
    expect(decrypt(data.enc, phone.key)).toEqual({
      ...content,
      expiresAt: expiresAt.toISOString(),
    });
    expect(() => decrypt(data.enc, tablet.key)).toThrow();
    expect(dataSentTo('tok-tablet').enc).not.toBe(data.enc);
  });

  it('gives FCM the whole seconds left as the TTL', async () => {
    await register('tok-phone');
    await deliver(new Date(Date.now() + 90_500));
    const ttl = (send.mock.calls[0] as [string, unknown, number])[2];
    expect(ttl === 90 || ttl === 89).toBe(true);
  });

  it('deletes a dead (unregistered) device and marks it done', async () => {
    const dead = await register('tok-dead');
    await register('tok-ok');
    send.mockImplementation((t: string) =>
      Promise.resolve(t === 'tok-dead' ? 'gone' : 'sent'),
    );

    await deliver();

    expect([...repo.rows.keys()]).toEqual(['tok-ok']);
    expect(progress.isDone(`fcm:${dead.id}`)).toBe(true);
  });

  it('a failed device is marked done without being deleted or retried', async () => {
    const bad = await register('tok-bad');
    send.mockResolvedValue('failed');

    await deliver();

    expect(repo.rows.has('tok-bad')).toBe(true);
    expect(progress.isDone(`fcm:${bad.id}`)).toBe(true);
  });

  it('retries only the busy device after trying all; the retry skips the done ones', async () => {
    await register('tok-busy');
    const ok = await register('tok-ok');
    send.mockImplementation((t: string) =>
      Promise.resolve(t === 'tok-busy' ? 'retry' : 'sent'),
    );

    await expect(deliver()).rejects.toBeInstanceOf(RetryableDeliveryException);
    expect(progress.isDone(`fcm:${ok.id}`)).toBe(true);

    send.mockClear();
    send.mockResolvedValue('sent');
    await deliver(); // the retry
    expect(sentTo()).toEqual(['tok-busy']);
  });

  it('stops once expiresAt has passed', async () => {
    await register('tok-phone');
    await deliver(new Date(Date.now() - 1000));
    expect(send).not.toHaveBeenCalled();
  });

  it('skips a device whose stored key is unusable, without sending it anything', async () => {
    const broken = await register('tok-broken', 'u1', 'c2hvcnQ=');
    await register('tok-ok');

    await deliver();

    expect(sentTo()).toEqual(['tok-ok']);
    expect(progress.isDone(`fcm:${broken.id}`)).toBe(true);
  });

  it('never logs a token or a key', async () => {
    const logs: string[] = [];
    for (const level of ['log', 'warn'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((m: unknown) => {
        logs.push(String(m));
      });
    }
    const a = await register('tok-secret-a');
    const b = await register('tok-secret-b');
    const c = await register('tok-secret-c', 'u1', 'c2hvcnQ=');
    send.mockImplementation((t: string) =>
      Promise.resolve(t.endsWith('a') ? 'gone' : 'failed'),
    );

    await deliver();

    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toMatch(/tok-secret/);
      for (const key of [a.key, b.key, c.key]) expect(line).not.toContain(key);
    }
  });
});
