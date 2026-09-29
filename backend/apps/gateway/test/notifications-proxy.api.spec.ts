import type { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { NotificationsProxyModule } from '../src/notifications-proxy/notifications-proxy.module';
import { NOTIFICATIONS_SERVICE_CLIENT } from '../src/tokens';
import { bootProxy, TEST_JWT_SECRET } from './proxy-app';

describe('notifications-proxy (gateway)', () => {
  let app: INestApplication;
  let base: string;
  let forward: jest.Mock;

  beforeEach(async () => {
    ({ app, base, forward } = await bootProxy(
      NotificationsProxyModule,
      NOTIFICATIONS_SERVICE_CLIENT,
      { status: 204, body: '' },
    ));
  });

  afterEach(() => app?.close());

  const token = jwt.sign(
    { sub: 'user-1', role: 'user', email: 'a@b.c' },
    TEST_JWT_SECRET,
  );
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'BPk', auth: 'xyz' },
  };
  const send = (
    method: 'POST' | 'DELETE',
    headers: Record<string, string>,
    body: unknown,
  ) =>
    fetch(`${base}/notifications/subscriptions`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('forwards GET /notifications/vapid-public-key without a token', async () => {
    forward.mockResolvedValue({ status: 200, body: { publicKey: 'BK' } });

    const res = await fetch(`${base}/notifications/vapid-public-key`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ publicKey: 'BK' });
    expect(forward).toHaveBeenCalledWith({
      method: 'GET',
      path: '/notifications/vapid-public-key',
    });
  });

  it.each(['POST', 'DELETE'] as const)(
    'forwards %s /notifications/subscriptions with the user id from the token',
    async (method) => {
      const res = await send(
        method,
        { authorization: `Bearer ${token}` },
        subscription,
      );

      expect(res.status).toBe(204);
      expect(forward).toHaveBeenCalledWith({
        method,
        path: '/notifications/subscriptions',
        body: subscription,
        headers: { 'x-user-id': 'user-1' },
      });
    },
  );

  it.each(['POST', 'DELETE'] as const)(
    'rejects %s without a valid token and forwards nothing',
    async (method) => {
      for (const headers of [{}, { authorization: 'Bearer nope' }] as Record<
        string,
        string
      >[]) {
        expect((await send(method, headers, subscription)).status).toBe(401);
      }
      expect(forward).not.toHaveBeenCalled();
    },
  );

  it("ignores a client-sent x-user-id — only the token's user is forwarded", async () => {
    await send(
      'POST',
      { authorization: `Bearer ${token}`, 'x-user-id': 'someone-else' },
      subscription,
    );

    expect(forward).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'x-user-id': 'user-1' } }),
    );
  });
});
