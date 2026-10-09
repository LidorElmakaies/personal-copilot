import type { INestApplication } from '@nestjs/common';
import { createServer, type IncomingHttpHeaders, type Server } from 'http';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { ProxyRoute } from '../src/proxy/application/interfaces/proxy-service.interface';
import { PROXY_ROUTES } from '../src/proxy/proxy.routes';
import { bootProxy, TEST_JWT_SECRET, type FakeClients } from './proxy-app';

const STRICT_LIMIT = 2;
const token = jwt.sign(
  { sub: 'user-1', role: 'user', email: 'a@b.c' },
  TEST_JWT_SECRET,
);
// The public contract, written out apart from PROXY_ROUTES so a wrong row there fails here.
// prettier-ignore
const CONTRACT: readonly ProxyRoute[] = [
  { method: 'POST', path: '/auth/register', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'POST', path: '/auth/login', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'POST', path: '/auth/refresh', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'POST', path: '/auth/logout', service: 'users', auth: 'none' },
  { method: 'POST', path: '/auth/account', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'DELETE', path: '/auth/account', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'GET', path: '/users/me', service: 'users', auth: 'user' },
  { method: 'PATCH', path: '/users/me', service: 'users', auth: 'user' },
  { method: 'PUT', path: '/users/me/location', service: 'users', auth: 'user' },
  { method: 'GET', path: '/reminders', service: 'reminders', auth: 'user' },
  { method: 'PUT', path: '/reminders/shabbat-candles', service: 'reminders', auth: 'user' },
  { method: 'DELETE', path: '/reminders/shabbat-candles', service: 'reminders', auth: 'user' },
  { method: 'GET', path: '/notifications/vapid-public-key', service: 'notifications', auth: 'none' },
  { method: 'POST', path: '/notifications/subscriptions', service: 'notifications', auth: 'user' },
  { method: 'DELETE', path: '/notifications/subscriptions', service: 'notifications', auth: 'user' },
];
const rows = (routes: readonly ProxyRoute[]) =>
  routes.map((route) => [`${route.method} ${route.path}`, route] as const);
const userRoutes = CONTRACT.filter((r) => r.auth === 'user');
const openRoutes = CONTRACT.filter((r) => r.auth === 'none');
const strictRoutes = CONTRACT.filter((r) => r.throttle === 'strict');
const globalRoutes = CONTRACT.filter((r) => r.throttle !== 'strict');

// fetch refuses a body on GET.
const bodyFor = (route: Pick<ProxyRoute, 'method'>) =>
  route.method === 'GET' ? undefined : { field: 'value' };

function send(
  base: string,
  route: Pick<ProxyRoute, 'method' | 'path'>,
  headers: Record<string, string> = {},
  body: unknown = bodyFor(route),
) {
  return fetch(`${base}${route.path}`, {
    method: route.method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const byRoute = (a: ProxyRoute, b: ProxyRoute) =>
  `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`);

const forwarded = (clients: FakeClients) =>
  Object.values(clients).flatMap(
    (client) => client.forward.mock.calls as unknown[][],
  );

it('PROXY_ROUTES matches CONTRACT row for row — a new route needs a row in both', () => {
  expect([...PROXY_ROUTES].sort(byRoute)).toEqual([...CONTRACT].sort(byRoute));
});

describe('proxy (gateway): every route', () => {
  let app: INestApplication;
  let base: string;
  let clients: FakeClients;

  beforeEach(async () => {
    process.env.AUTH_THROTTLE_LIMIT = String(STRICT_LIMIT);
    ({ app, base, clients } = await bootProxy());
  });

  afterEach(async () => {
    delete process.env.AUTH_THROTTLE_LIMIT;
    await app?.close();
  });

  it.each(rows(userRoutes))(
    '%s: no token or a bad one → 401, nothing forwarded',
    async (_label, route) => {
      expect((await send(base, route)).status).toBe(401);
      expect(
        (await send(base, route, { authorization: 'Bearer nope' })).status,
      ).toBe(401);
      expect(forwarded(clients)).toEqual([]);
    },
  );

  it.each(rows(openRoutes))('%s: works without a token', async (_l, route) => {
    expect((await send(base, route)).status).toBe(200);
    expect(clients[route.service].forward).toHaveBeenCalledTimes(1);
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
  ])('rejects %s with 401 and forwards nothing', async (_label, bad) => {
    const route = { method: 'GET', path: '/users/me' } as const;
    expect(
      (await send(base, route, { authorization: `Bearer ${bad}` })).status,
    ).toBe(401);
    expect(forwarded(clients)).toEqual([]);
  });

  it.each([
    ['GET', '/auth/login'],
    ['POST', '/users/me'],
    ['GET', '/users/someone-else'],
    ['PATCH', '/reminders/shabbat-candles'],
    ['GET', '/notifications/subscriptions'],
    ['GET', '/internal/anything'],
  ] as const)(
    'an unlisted route (%s %s) → 404, nothing forwarded',
    async (method, path) => {
      const res = await send(
        base,
        { method, path },
        { authorization: `Bearer ${token}` },
        method === 'GET' ? undefined : {},
      );
      expect(res.status).toBe(404);
      expect(forwarded(clients)).toEqual([]);
    },
  );

  it.each([
    ['a 401', 401, { statusCode: 401, message: 'Invalid credentials' }],
    [
      'a 400 validation error',
      400,
      {
        statusCode: 400,
        message: ['offsetMinutes must not be greater than 1440'],
        error: 'Bad Request',
      },
    ],
    [
      'a 502 when the service is down',
      502,
      {
        error: {
          code: 'reminders_service_unreachable',
          message: 'connect ECONNREFUSED',
        },
      },
    ],
  ])('relays %s unchanged', async (_name, status, body) => {
    clients.reminders.forward.mockResolvedValue({ status, body });
    const res = await send(
      base,
      { method: 'PUT', path: '/reminders/shabbat-candles' },
      { authorization: `Bearer ${token}` },
    );
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(body);
  });

  it('ends an empty-body response without a body', async () => {
    clients.users.forward.mockResolvedValue({ status: 204, body: '' });
    const res = await send(base, { method: 'POST', path: '/auth/logout' });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it.each(rows(strictRoutes))(
    '%s: strict limit, counted for this route alone',
    async (_label, route) => {
      for (let i = 0; i < STRICT_LIMIT; i++)
        expect((await send(base, route)).status).toBe(200);
      expect((await send(base, route)).status).toBe(429);

      const other = strictRoutes.find((r) => r !== route)!;
      expect((await send(base, other)).status).toBe(200);
    },
  );

  it.each(rows(globalRoutes))(
    '%s: only the global limit',
    async (_label, route) => {
      const auth = { authorization: `Bearer ${token}` };
      for (let i = 0; i <= STRICT_LIMIT; i++)
        expect((await send(base, route, auth)).status).toBe(200);
    },
  );
});

// Real ServiceHttpClients over real HTTP: what actually arrives at each internal service.
describe('proxy (gateway) → internal services, over the wire', () => {
  type Received = {
    service: string;
    method?: string;
    url?: string;
    headers: IncomingHttpHeaders;
    body: string;
  };
  const services = ['users', 'reminders', 'notifications'] as const;
  const upstreams: Server[] = [];
  let received: Received[];
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const urls: Record<string, string> = {};
    for (const service of services) {
      const upstream = createServer((req, res) => {
        let body = '';
        req.on('data', (c: Buffer) => (body += c.toString()));
        req.on('end', () => {
          received.push({
            service,
            method: req.method,
            url: req.url,
            headers: req.headers,
            body,
          });
          res.writeHead(204).end();
        });
      });
      await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r));
      upstreams.push(upstream);
      const { port } = upstream.address() as AddressInfo;
      urls[`${service.toUpperCase()}_SERVICE_URL`] = `http://127.0.0.1:${port}`;
    }
    ({ app, base } = await bootProxy({ urls }));
  });

  afterAll(async () => {
    await app.close();
    await Promise.all(
      upstreams.map((u) => new Promise<void>((r) => u.close(() => r()))),
    );
  });

  beforeEach(() => (received = []));

  it.each(rows(CONTRACT))(
    '%s reaches its service as-is, with only the user id Gateway sets',
    async (_label, route) => {
      const res = await send(base, route, {
        authorization: `Bearer ${token}`,
        'x-user-id': 'someone-else',
        'X-USER-ID': 'someone-else-2',
        cookie: 'session=abc',
        'x-forwarded-for': '1.2.3.4',
      });

      expect(res.status).toBe(204);
      expect(received).toHaveLength(1);
      const [req] = received;
      expect(req.service).toBe(route.service);
      expect(req.method).toBe(route.method);
      expect(req.url).toBe(route.path);
      expect(req.headers['x-user-id']).toBe(
        route.auth === 'user' ? 'user-1' : undefined,
      );
      expect(req.headers.authorization).toBeUndefined();
      expect(req.headers.cookie).toBeUndefined();
      expect(req.headers['x-forwarded-for']).toBeUndefined();
      const body = bodyFor(route);
      expect(req.body ? (JSON.parse(req.body) as unknown) : undefined).toEqual(
        body,
      );
    },
  );
});
