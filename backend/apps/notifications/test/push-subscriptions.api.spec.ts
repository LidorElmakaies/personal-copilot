import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PushSubscriptionsController } from '../src/api/controllers/push-subscriptions.controller';
import { PushSubscriptionService } from '../src/application/push-subscription.service';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  PUSH_SUBSCRIPTION_SERVICE,
  VAPID_CONFIG,
} from '../src/tokens';
import { InMemoryPushSubscriptionRepository } from './in-memory-push-subscription.repository';

describe('push subscriptions (notifications)', () => {
  let app: INestApplication;
  let base: string;
  let repo: InMemoryPushSubscriptionRepository;

  beforeEach(async () => {
    repo = new InMemoryPushSubscriptionRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [PushSubscriptionsController],
      providers: [
        {
          provide: PUSH_SUBSCRIPTION_SERVICE,
          useClass: PushSubscriptionService,
        },
        { provide: PUSH_SUBSCRIPTION_REPOSITORY, useValue: repo },
        {
          provide: VAPID_CONFIG,
          useValue: {
            publicKey: 'BPublic',
            privateKey: 'priv',
            subject: 'mailto:x@y.z',
          },
        },
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

  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc';
  const subscription = {
    endpoint,
    expirationTime: null,
    keys: {
      p256dh:
        'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
  };
  const send = (
    method: 'POST' | 'DELETE',
    body: unknown,
    userId: string | null = 'user-1',
  ) =>
    fetch(`${base}/notifications/subscriptions`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
      },
      body: JSON.stringify(body),
    });

  it('serves the VAPID public key', async () => {
    const res = await fetch(`${base}/notifications/vapid-public-key`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ publicKey: 'BPublic' });
  });

  it("stores the browser's PushSubscription.toJSON() for the forwarded user", async () => {
    expect((await send('POST', subscription)).status).toBe(204);
    expect(repo.rows.get(endpoint)).toMatchObject({
      userId: 'user-1',
      endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
  });

  it('moves an endpoint to whoever registers it last (re-login on the same browser)', async () => {
    await send('POST', subscription, 'user-1');
    await send('POST', subscription, 'user-2');
    expect(repo.rows.size).toBe(1);
    expect(repo.rows.get(endpoint)?.userId).toBe('user-2');
  });

  it("deletes only the caller's own subscription, idempotently", async () => {
    await send('POST', subscription, 'user-1');

    expect((await send('DELETE', { endpoint }, 'user-2')).status).toBe(204);
    expect(repo.rows.has(endpoint)).toBe(true);

    expect((await send('DELETE', { endpoint }, 'user-1')).status).toBe(204);
    expect((await send('DELETE', { endpoint }, 'user-1')).status).toBe(204);
    expect(repo.rows.has(endpoint)).toBe(false);
  });

  it.each(['POST', 'DELETE'] as const)(
    '%s answers 401 without a forwarded user id',
    async (method) => {
      expect((await send(method, subscription, null)).status).toBe(401);
      expect(repo.rows.size).toBe(0);
    },
  );

  it.each([
    [
      'a plain-http endpoint',
      { ...subscription, endpoint: 'http://auth:8001/x' },
    ],
    ['an internal host', { ...subscription, endpoint: 'https://auth/x' }],
    [
      'an https host that is not a push service',
      { ...subscription, endpoint: 'https://evil.example.com/x' },
    ],
    ['missing keys', { endpoint }],
    [
      'a non-base64url key',
      { ...subscription, keys: { ...subscription.keys, auth: 'a b' } },
    ],
  ])('rejects %s with 400', async (_name, body) => {
    expect((await send('POST', body)).status).toBe(400);
    expect(repo.rows.size).toBe(0);
  });

  it.each([
    [
      'an endpoint over 2048 chars',
      {
        ...subscription,
        endpoint: `https://fcm.googleapis.com/fcm/send/${'a'.repeat(2048)}`,
      },
    ],
    [
      'a p256dh over 128 chars',
      {
        ...subscription,
        keys: { ...subscription.keys, p256dh: 'A'.repeat(129) },
      },
    ],
    [
      'an auth over 64 chars',
      { ...subscription, keys: { ...subscription.keys, auth: 'A'.repeat(65) } },
    ],
    [
      'a p256dh that is not 65 bytes',
      { ...subscription, keys: { ...subscription.keys, p256dh: 'BPk' } },
    ],
    [
      'an auth secret that is not 16 bytes',
      { ...subscription, keys: { ...subscription.keys, auth: 'xyz' } },
    ],
    ['keys as a string', { ...subscription, keys: 'p256dh=x' }],
    ['keys as an array', { ...subscription, keys: [subscription.keys] }],
    ['a non-string endpoint', { ...subscription, endpoint: 42 }],
    [
      'a push host hidden in userinfo',
      { ...subscription, endpoint: 'https://fcm.googleapis.com@evil.com/x' },
    ],
  ])('rejects %s with 400', async (_name, body) => {
    expect((await send('POST', body)).status).toBe(400);
    expect(repo.rows.size).toBe(0);
  });

  // See test/push-endpoint-host.spec.ts — web-push would dial evil.example.
  it('rejects an endpoint whose host url.parse reads differently', async () => {
    const res = await send('POST', {
      ...subscription,
      endpoint: 'https://evil.example;.fcm.googleapis.com/x',
    });
    expect(res.status).toBe(400);
  });

  it.each([
    ['a zero-padded 443', 'https://fcm.googleapis.com:0443/fcm/send/abc'],
  ])('accepts %s', async (_name, ep) => {
    expect((await send('POST', { ...subscription, endpoint: ep })).status).toBe(
      204,
    );
  });

  // A lone '%' in userinfo makes legacy url.parse throw; must be a 400, not a 500.
  it('rejects an endpoint with malformed percent-encoding in userinfo with 400', async () => {
    const res = await send('POST', {
      ...subscription,
      endpoint: 'https://a%@fcm.googleapis.com/x',
    });
    expect(res.status).toBe(400);
  });

  it('ignores a userId in the body — only the forwarded user owns the row', async () => {
    await send('POST', { ...subscription, userId: 'attacker' }, 'user-1');
    expect(repo.rows.get(endpoint)?.userId).toBe('user-1');
  });

  it('answers 401 for an empty forwarded user id', async () => {
    const res = await fetch(`${base}/notifications/subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': '' },
      body: JSON.stringify(subscription),
    });
    expect(res.status).toBe(401);
    expect(repo.rows.size).toBe(0);
  });

  it.each([
    ['a missing endpoint', {}],
    ['a non-URL endpoint', { endpoint: 'nope' }],
    ['an http endpoint', { endpoint: 'http://fcm.googleapis.com/x' }],
  ])('DELETE rejects %s with 400', async (_name, body) => {
    await send('POST', subscription);
    expect((await send('DELETE', body)).status).toBe(400);
    expect(repo.rows.has(endpoint)).toBe(true);
  });
});
