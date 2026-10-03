import type { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { RemindersProxyModule } from '../src/reminders-proxy/reminders-proxy.module';
import { REMINDERS_SERVICE_CLIENT } from '../src/tokens';
import { bootProxy, TEST_JWT_SECRET } from './proxy-app';

describe('reminders-proxy (gateway)', () => {
  let app: INestApplication;
  let base: string;
  let forward: jest.Mock;

  beforeEach(async () => {
    ({ app, base, forward } = await bootProxy(
      RemindersProxyModule,
      REMINDERS_SERVICE_CLIENT,
      { status: 200, body: [] },
    ));
  });

  afterEach(() => app?.close());

  const token = jwt.sign(
    { sub: 'user-1', role: 'user', email: 'a@b.c' },
    TEST_JWT_SECRET,
  );
  const settings = {
    offsetMinutes: 90,
  };
  const routes = [
    ['GET', '/reminders', undefined],
    ['PUT', '/reminders/shabbat-candles', settings],
    ['DELETE', '/reminders/shabbat-candles', undefined],
  ] as const;
  const send = (
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it.each(routes)(
    'forwards %s %s with the user id from the token',
    async (method, path, body) => {
      const res = await send(method, path, body, {
        authorization: `Bearer ${token}`,
        'x-user-id': 'someone-else',
      });

      expect(res.status).toBe(200);
      expect(forward).toHaveBeenCalledWith({
        method,
        path,
        ...(body ? { body } : {}),
        headers: { 'x-user-id': 'user-1' },
      });
    },
  );

  it.each(routes)(
    'rejects %s %s without a valid token and forwards nothing',
    async (method, path, body) => {
      for (const headers of [{}, { authorization: 'Bearer nope' }] as Record<
        string,
        string
      >[]) {
        expect((await send(method, path, body, headers)).status).toBe(401);
      }
      expect(forward).not.toHaveBeenCalled();
    },
  );

  it.each([
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
      'a 502 when Reminders Service is down',
      502,
      {
        error: {
          code: 'reminders_service_unreachable',
          message: 'connect ECONNREFUSED',
        },
      },
    ],
  ])('relays %s unchanged', async (_name, status, body) => {
    forward.mockResolvedValue({ status, body });
    const res = await send(
      'PUT',
      '/reminders/shabbat-candles',
      {},
      {
        authorization: `Bearer ${token}`,
      },
    );
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(body);
  });

  it('relays a 204 with no body', async () => {
    forward.mockResolvedValue({ status: 204, body: '' });
    const res = await send('DELETE', '/reminders/shabbat-candles', undefined, {
      authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });
});
