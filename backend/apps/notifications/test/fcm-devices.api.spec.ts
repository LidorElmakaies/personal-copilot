import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'crypto';
import { FcmDevicesController } from '../src/api/controllers/fcm-devices.controller';
import { FcmDeviceService } from '../src/application/fcm-device.service';
import { FCM_DEVICE_REPOSITORY, FCM_DEVICE_SERVICE } from '../src/tokens';
import { InMemoryFcmDeviceRepository } from './in-memory-fcm-device.repository';

describe('FCM devices (notifications)', () => {
  let app: INestApplication;
  let base: string;
  let repo: InMemoryFcmDeviceRepository;

  beforeEach(async () => {
    repo = new InMemoryFcmDeviceRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [FcmDevicesController],
      providers: [
        { provide: FCM_DEVICE_SERVICE, useClass: FcmDeviceService },
        { provide: FCM_DEVICE_REPOSITORY, useValue: repo },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    ); // same as main.ts
    await app.listen(0);
    base = await app.getUrl();
  });

  afterEach(() => app.close());

  const token = 'ekzjBg6XR_uxAbC:APA91bH-x_Y1z2';
  const key = randomBytes(32).toString('base64');
  const send = (
    method: 'PUT' | 'DELETE',
    body: unknown,
    userId: string | null = 'user-1',
  ) =>
    fetch(`${base}/notifications/fcm-devices`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
      },
      body: JSON.stringify(body),
    });

  it('stores the device for the forwarded user', async () => {
    expect((await send('PUT', { token, key })).status).toBe(204);
    expect(repo.rows.get(token)).toMatchObject({
      userId: 'user-1',
      token,
      key,
    });
  });

  it('is idempotent, and a token already registered moves to whoever registers it now, with the new key', async () => {
    await send('PUT', { token, key });
    await send('PUT', { token, key });
    expect(repo.rows.size).toBe(1);

    const newKey = randomBytes(32).toString('base64');
    expect((await send('PUT', { token, key: newKey }, 'user-2')).status).toBe(
      204,
    );
    expect(repo.rows.get(token)).toMatchObject({
      userId: 'user-2',
      key: newKey,
    });
  });

  it.each([
    ['no token', { key }],
    ['a token with other characters', { token: 'abc def', key }],
    ['a token too long', { token: 'a'.repeat(4097), key }],
    ['no key', { token }],
    ['a key of 16 bytes', { token, key: randomBytes(16).toString('base64') }],
    ['a key that is not base64', { token, key: '!'.repeat(44) }],
    [
      'a key as base64url',
      { token, key: Buffer.alloc(32, 0xfb).toString('base64url') },
    ],
  ])('refuses %s → 400, nothing stored', async (_name, body) => {
    expect((await send('PUT', body)).status).toBe(400);
    expect(repo.rows.size).toBe(0);
  });

  it('requires the forwarded user', async () => {
    expect((await send('PUT', { token, key }, null)).status).toBe(401);
    expect(repo.rows.size).toBe(0);
  });

  it("DELETE removes the user's own device, is idempotent, and leaves someone else's alone", async () => {
    await send('PUT', { token, key });
    expect((await send('DELETE', { token }, 'user-2')).status).toBe(204);
    expect(repo.rows.has(token)).toBe(true);

    expect((await send('DELETE', { token })).status).toBe(204);
    expect(repo.rows.has(token)).toBe(false);
    expect((await send('DELETE', { token })).status).toBe(204);
  });
});
