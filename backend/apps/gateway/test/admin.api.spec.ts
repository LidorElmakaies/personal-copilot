import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createServer, type Server } from 'http';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import { AdminModule } from '../src/admin/admin.module';
import { TEST_JWT_SECRET } from './proxy-app';

// Real HTTP servers stand in for the internal services' /health.
function healthServer(
  handler: (res: import('http').ServerResponse) => void,
): Promise<{ server: Server; url: string }> {
  const server = createServer((_req, res) => handler(res));
  return new Promise((resolve) =>
    server.listen(0, () =>
      resolve({
        server,
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      }),
    ),
  );
}

describe('GET /admin/status (gateway)', () => {
  let app: INestApplication;
  let base: string;
  const servers: Server[] = [];

  beforeAll(async () => {
    const users = await healthServer((res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'users',
          version: '0.2.0',
          builtAt: '2026-10-05T18:00:00Z',
          startedAt: '2026-10-06T08:00:00.000Z',
        }),
      );
    });
    servers.push(users.server);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              USERS_SERVICE_URL: users.url,
              ADMIN_STATUS_TIMEOUT_MS: 150,
              JWT_SECRET: TEST_JWT_SECRET,
            }),
          ],
        }),
        AdminModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    servers.forEach((s) => {
      s.closeAllConnections();
      s.close();
    });
  });

  const token = (role: string) =>
    jwt.sign({ sub: 'u-1', role, email: 'a@b.c' }, TEST_JWT_SECRET);
  const get = (headers: Record<string, string> = {}) =>
    fetch(`${base}/admin/status`, { headers });

  it('reports Gateway itself plus the Users Service', async () => {
    const res = await get({ authorization: `Bearer ${token('admin')}` });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body.map((s) => s.service)).toEqual(['gateway', 'users']);
    expect(body[0]).toMatchObject({ status: 'up', latencyMs: null });
    expect(body[1]).toMatchObject({
      service: 'users',
      status: 'up',
      version: '0.2.0',
      builtAt: '2026-10-05T18:00:00Z',
      startedAt: '2026-10-06T08:00:00.000Z',
    });
    expect(typeof body[1].latencyMs).toBe('number');
  });

  it.each([
    ['unreachable', null],
    [
      'answering 500',
      (res: import('http').ServerResponse) => {
        res.writeHead(500);
        res.end();
      },
    ],
    [
      "answering after the probe's timeout",
      (res: import('http').ServerResponse) => {
        setTimeout(() => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{"status":"ok"}');
        }, 500);
      },
    ],
  ])('reports the Users Service %s as down', async (_name, handler) => {
    let url = 'http://127.0.0.1:1';
    if (handler) {
      const users = await healthServer(handler);
      servers.push(users.server);
      url = users.url;
    }
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              USERS_SERVICE_URL: url,
              ADMIN_STATUS_TIMEOUT_MS: 150,
              JWT_SECRET: TEST_JWT_SECRET,
            }),
          ],
        }),
        AdminModule,
      ],
    }).compile();
    const other = moduleRef.createNestApplication();
    await other.listen(0);
    try {
      const res = await fetch(`${await other.getUrl()}/admin/status`, {
        headers: { authorization: `Bearer ${token('admin')}` },
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([
        expect.objectContaining({ service: 'gateway', status: 'up' }),
        {
          service: 'users',
          status: 'down',
          version: null,
          builtAt: null,
          startedAt: null,
          latencyMs: null,
        },
      ]);
    } finally {
      await other.close();
    }
  });

  it('rejects a signed-in user with 403', async () => {
    expect(
      (await get({ authorization: `Bearer ${token('user')}` })).status,
    ).toBe(403);
  });

  it('rejects no or a bad token with 401', async () => {
    expect((await get()).status).toBe(401);
    expect((await get({ authorization: 'Bearer nope' })).status).toBe(401);
  });
});
