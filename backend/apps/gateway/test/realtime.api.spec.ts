import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import jwt from 'jsonwebtoken';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { RealtimeModule } from '../src/realtime/realtime.module';
import type { IRealtimeConnectionService } from '../src/realtime/application/interfaces/realtime-connection.interface';
import { REALTIME_CONNECTION_SERVICE } from '../src/tokens';
import { TEST_JWT_SECRET } from './proxy-app';

const DEVICE_TOKEN_LIMIT = 3;
const tokenFor = (sub: string) =>
  jwt.sign({ sub, role: 'user', email: `${sub}@b.c` }, TEST_JWT_SECRET);

// POST /realtime/device and a real Socket.IO client against RealtimeGateway at /ws, with the
// app's rate limiting in place (the device-token route's strict limit lowered for the test).
describe('Realtime (gateway): device tokens and /ws', () => {
  let app: NestExpressApplication;
  let base: string;
  let realtime: IRealtimeConnectionService;
  const clients: ClientSocket[] = [];
  let requestIp = 0; // each test's token requests come from their own client IP

  beforeAll(async () => {
    process.env.AUTH_THROTTLE_LIMIT = String(DEVICE_TOKEN_LIMIT);
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: TEST_JWT_SECRET })],
        }),
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 100 }],
        }),
        RealtimeModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 'loopback'); // the test client is loopback; X-Forwarded-For picks its IP
    app.useWebSocketAdapter(new IoAdapter(app)); // same as main.ts
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    realtime = app.get(REALTIME_CONNECTION_SERVICE);
  });

  afterEach(async () => {
    while (clients.length) clients.pop()!.close();
    await new Promise((r) => setTimeout(r, 100)); // let the server unregister them
  });

  afterAll(async () => {
    delete process.env.AUTH_THROTTLE_LIMIT;
    await app?.close();
  });

  function requestDeviceToken(ip = `198.51.100.${++requestIp}`) {
    return fetch(`${base}/realtime/device`, {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    });
  }

  async function deviceToken(): Promise<string> {
    const response = await requestDeviceToken();
    return ((await response.json()) as { device_token: string }).device_token;
  }

  // Resolves once the handshake settles: 'connected', or the server's refusal reason.
  function connect(
    auth: Record<string, string>,
  ): Promise<{ socket: ClientSocket; result: string }> {
    const socket = io(base, {
      path: '/ws',
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      auth,
    });
    clients.push(socket);
    return new Promise((resolve) => {
      socket.on('connect', () => resolve({ socket, result: 'connected' }));
      socket.on('connect_error', (error) =>
        resolve({ socket, result: error.message }),
      );
    });
  }

  function received(socket: ClientSocket, event: string): unknown[] {
    const payloads: unknown[] = [];
    socket.on(event, (payload: unknown) => payloads.push(payload));
    return payloads;
  }

  const tick = () => new Promise((r) => setTimeout(r, 100));

  it('POST /realtime/device issues a device token', async () => {
    const response = await requestDeviceToken();
    expect(response.status).toBe(201);
    const body = (await response.json()) as { device_token: string };
    expect(typeof body.device_token).toBe('string');
  });

  it('device tokens are rate-limited per client IP — what bounds how many /ws connections one client can hold', async () => {
    const ip = '203.0.113.50';
    for (let i = 0; i < DEVICE_TOKEN_LIMIT; i++)
      expect((await requestDeviceToken(ip)).status).toBe(201);
    expect((await requestDeviceToken(ip)).status).toBe(429);
    expect((await requestDeviceToken('203.0.113.51')).status).toBe(201);
  });

  it.each([
    ['no device token', () => ({})],
    ['a made-up device token', () => ({ deviceToken: 'IMFAKEUSER' })],
    [
      'a device token signed with another secret',
      () => ({
        deviceToken: jwt.sign({ sub: 'd-1', typ: 'device' }, 'not-the-secret'),
      }),
    ],
    [
      "a user's access token in place of a device token",
      () => ({ deviceToken: tokenFor('u-1') }),
    ],
  ])('refuses %s', async (_label, auth) => {
    expect((await connect(auth())).result).toBe('device_token_invalid');
  });

  it('refuses a login token that does not verify, even with a valid device token', async () => {
    const device = await deviceToken();
    const forged = jwt.sign(
      { sub: 'u-9', role: 'user', email: 'u-9@b.c' },
      'not-the-secret',
    );
    expect(
      (await connect({ deviceToken: device, token: 'IMFAKEUSER' })).result,
    ).toBe('token_invalid');
    expect((await connect({ deviceToken: device, token: forged })).result).toBe(
      'token_invalid',
    );
  });

  it("an anonymous device gets broadcasts but never a user's push", async () => {
    const anon = await connect({ deviceToken: await deviceToken() });
    const user = await connect({
      deviceToken: await deviceToken(),
      token: tokenFor('u-1'),
    });
    expect(anon.result).toBe('connected');
    expect(user.result).toBe('connected');
    const updates = received(anon.socket, 'app-update');
    const pushes = received(anon.socket, 'ping-user');

    expect(realtime.broadcast('app-update', {})).toBe(2);
    expect(realtime.pushToUser('u-1', 'ping-user', { n: 1 })).toBe(true);
    expect(realtime.pushToUser('u-nobody', 'ping-user', { n: 2 })).toBe(false);
    await tick();

    expect(updates).toEqual([{}]);
    expect(pushes).toEqual([]);
  });

  it("a user's push reaches every device they're signed in on", async () => {
    const phone = await connect({
      deviceToken: await deviceToken(),
      token: tokenFor('u-2'),
    });
    const tablet = await connect({
      deviceToken: await deviceToken(),
      token: tokenFor('u-2'),
    });
    const onPhone = received(phone.socket, 'ping-user');
    const onTablet = received(tablet.socket, 'ping-user');

    expect(realtime.pushToUser('u-2', 'ping-user', { n: 1 })).toBe(true);
    await tick();

    expect(onPhone).toEqual([{ n: 1 }]);
    expect(onTablet).toEqual([{ n: 1 }]);
  });

  it("a device's new connection replaces its old one at once (a network switch)", async () => {
    const sameDevice = await deviceToken();
    const old = await connect({ deviceToken: sameDevice });
    const dropped = new Promise<string>((resolve) =>
      old.socket.on('disconnect', resolve),
    );

    const fresh = await connect({ deviceToken: sameDevice });
    expect(fresh.result).toBe('connected');
    expect(await dropped).toBe('io server disconnect');
    await tick();

    const updates = received(fresh.socket, 'app-update');
    expect(realtime.broadcast('app-update', {})).toBe(1);
    await tick();
    expect(updates).toEqual([{}]);
  });
});
