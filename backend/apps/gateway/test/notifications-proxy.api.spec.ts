import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createServer, type IncomingHttpHeaders, type Server } from 'http';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
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
  it.each([
    [
      'a 400 validation error',
      400,
      {
        statusCode: 400,
        message: ['endpoint must be an https URL on a known push service'],
        error: 'Bad Request',
      },
    ],
    [
      'a 502 when Notification Service is down',
      502,
      {
        error: {
          code: 'notifications_service_unreachable',
          message: 'connect ECONNREFUSED',
        },
      },
    ],
  ])('relays %s unchanged', async (_name, status, body) => {
    forward.mockResolvedValue({ status, body });
    const res = await send('POST', { authorization: `Bearer ${token}` }, {});
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(body);
  });

  it.each([
    [
      'an expired token',
      jwt.sign(
        { sub: 'user-1', role: 'user', email: 'a@b.c', exp: 1 },
        TEST_JWT_SECRET,
      ),
    ],
    [
      'a token signed with another secret',
      jwt.sign({ sub: 'user-1', role: 'user', email: 'a@b.c' }, 'other'),
    ],
    [
      "an unsigned (alg: 'none') token",
      jwt.sign({ sub: 'user-1', role: 'user', email: 'a@b.c' }, '', {
        algorithm: 'none',
      }),
    ],
    [
      'a token without sub',
      jwt.sign({ role: 'user', email: 'a@b.c' }, TEST_JWT_SECRET),
    ],
  ])('rejects %s with 401 and forwards nothing', async (_name, bad) => {
    const res = await send(
      'POST',
      { authorization: `Bearer ${bad}` },
      subscription,
    );
    expect(res.status).toBe(401);
    expect(forward).not.toHaveBeenCalled();
  });
});

// Real ServiceHttpClient over real HTTP: what actually arrives at Notification Service.
describe('notifications-proxy → Notification Service, over the wire (gateway)', () => {
  let app: INestApplication;
  let base: string;
  let upstream: Server;
  let received: {
    method?: string;
    url?: string;
    headers: IncomingHttpHeaders;
    body: string;
  }[];

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        received.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body,
        });
        res.writeHead(204).end();
      });
    });
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r));
    const port = (upstream.address() as AddressInfo).port;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NOTIFICATIONS_SERVICE_URL: `http://127.0.0.1:${port}`,
              JWT_SECRET: TEST_JWT_SECRET,
            }),
          ],
        }),
        NotificationsProxyModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((r) => upstream.close(() => r()));
  });

  beforeEach(() => (received = []));

  const token = jwt.sign(
    { sub: 'user-1', role: 'user', email: 'a@b.c' },
    TEST_JWT_SECRET,
  );

  it.each(['POST', 'DELETE'] as const)(
    '%s: Notification Service sees only the token user, never client headers',
    async (method) => {
      const res = await fetch(`${base}/notifications/subscriptions`, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-user-id': 'someone-else',
          'X-USER-ID': 'someone-else-2',
          cookie: 'session=abc',
          'x-forwarded-for': '1.2.3.4',
        },
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        }),
      });

      expect(res.status).toBe(204);
      expect(received).toHaveLength(1);
      const [req] = received;
      expect(req.method).toBe(method);
      expect(req.url).toBe('/notifications/subscriptions');
      expect(req.headers['x-user-id']).toBe('user-1');
      expect(req.headers.authorization).toBeUndefined();
      expect(req.headers.cookie).toBeUndefined();
      expect(req.headers['x-forwarded-for']).toBeUndefined();
      expect(JSON.parse(req.body)).toEqual({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      });
    },
  );

  it('GET vapid-public-key forwards no user id, even one the client sent', async () => {
    await fetch(`${base}/notifications/vapid-public-key`, {
      headers: {
        'x-user-id': 'someone-else',
        authorization: `Bearer ${token}`,
      },
    });
    expect(received).toHaveLength(1);
    expect(received[0].headers['x-user-id']).toBeUndefined();
    expect(received[0].headers.authorization).toBeUndefined();
  });
});
