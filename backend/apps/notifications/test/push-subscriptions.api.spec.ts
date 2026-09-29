import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PushSubscriptionsController } from '../src/api/controllers/push-subscriptions.controller';
import { PushSubscriptionService } from '../src/application/push-subscription.service';
import type {
  IPushSubscriptionRepository,
  NewPushSubscription,
} from '../src/infrastructure/interfaces/push-subscription-repository.interface';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  PUSH_SUBSCRIPTION_SERVICE,
  VAPID_CONFIG,
} from '../src/tokens';

/** Same semantics as the TypeORM repository: endpoint is unique, delete is owner-scoped. */
class InMemoryPushSubscriptionRepository implements IPushSubscriptionRepository {
  readonly rows = new Map<string, NewPushSubscription>();

  upsertByEndpoint(subscription: NewPushSubscription): Promise<void> {
    this.rows.set(subscription.endpoint, { ...subscription });
    return Promise.resolve();
  }

  deleteByEndpoint(userId: string, endpoint: string): Promise<void> {
    if (this.rows.get(endpoint)?.userId === userId) this.rows.delete(endpoint);
    return Promise.resolve();
  }
}

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
    expect(repo.rows.get(endpoint)).toEqual({
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
    [
      'an endpoint without a TLD',
      { ...subscription, endpoint: 'https://auth/x' },
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
});
