import type { INestApplication } from '@nestjs/common';
import { AuthProxyModule } from '../src/auth-proxy/auth-proxy.module';
import { AUTH_SERVICE_CLIENT } from '../src/tokens';
import { bootProxy } from './proxy-app';

// Pins auth-proxy's behavior across the move to the shared proxy (src/proxy/).
describe('auth-proxy (gateway)', () => {
  let app: INestApplication;

  afterEach(() => app?.close());

  const post = (base: string, path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it.each(['register', 'login', 'refresh', 'logout', 'account'])(
    'forwards POST /auth/%s with its body',
    async (route) => {
      const booted = await bootProxy(AuthProxyModule, AUTH_SERVICE_CLIENT, {
        status: 200,
        body: { ok: true },
      });
      app = booted.app;

      const res = await post(booted.base, `/auth/${route}`, {
        email: 'a@b.c',
        password: 'pw',
      });

      expect(res.status).toBe(200);
      expect(booted.forward).toHaveBeenCalledWith({
        method: 'POST',
        path: `/auth/${route}`,
        body: { email: 'a@b.c', password: 'pw' },
      });
    },
  );

  it("relays Users Service's 401 status and error body unchanged", async () => {
    const error = { statusCode: 401, message: 'Invalid credentials' };
    const booted = await bootProxy(AuthProxyModule, AUTH_SERVICE_CLIENT, {
      status: 401,
      body: error,
    });
    app = booted.app;

    const res = await post(booted.base, '/auth/login', {
      email: 'a@b.c',
      password: 'wrong',
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(error);
  });

  it('ends an empty-body response without a body', async () => {
    const booted = await bootProxy(AuthProxyModule, AUTH_SERVICE_CLIENT, {
      status: 204,
      body: '',
    });
    app = booted.app;

    const res = await post(booted.base, '/auth/logout', { refresh_token: 't' });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('forwards DELETE /auth/account with its body, no token needed', async () => {
    const booted = await bootProxy(AuthProxyModule, AUTH_SERVICE_CLIENT, {
      status: 204,
      body: '',
    });
    app = booted.app;
    const body = { email: 'a@b.c', currentPassword: 'pw' };

    const res = await fetch(`${booted.base}/auth/account`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(204);
    expect(booted.forward).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/auth/account',
      body,
    });
  });
});
