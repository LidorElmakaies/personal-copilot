import type { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { USERS_SERVICE_CLIENT } from '../src/tokens';
import { UsersProxyModule } from '../src/users-proxy/users-proxy.module';
import { bootProxy, TEST_JWT_SECRET } from './proxy-app';

describe('users-proxy (gateway)', () => {
  let app: INestApplication;
  let base: string;
  let forward: jest.Mock;

  beforeEach(async () => {
    ({ app, base, forward } = await bootProxy(
      UsersProxyModule,
      USERS_SERVICE_CLIENT,
      { status: 200, body: { firstName: null } },
    ));
  });

  afterEach(() => app?.close());

  const token = jwt.sign(
    { sub: 'user-1', role: 'user', email: 'a@b.c' },
    TEST_JWT_SECRET,
  );
  const routes = [
    ['GET', '/users/me', undefined],
    ['PATCH', '/users/me', { firstName: 'Lidor' }],
    ['PUT', '/users/me/location', { lat: 32, lon: 34.8, tz: 'Asia/Jerusalem' }],
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

  it('relays a 404 for a deleted account unchanged', async () => {
    const body = { statusCode: 404, message: 'Account not found' };
    forward.mockResolvedValue({ status: 404, body });
    const res = await send('GET', '/users/me', undefined, {
      authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(body);
  });
});
