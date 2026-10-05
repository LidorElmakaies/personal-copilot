import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { AuthTokenService } from '../auth-token.service';
import { JsonWebTokenService } from '../jsonwebtoken.service';
import { AdminGuard } from './admin.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'test-secret';
const tokens = new AuthTokenService(
  new JsonWebTokenService({ get: () => SECRET } as unknown as ConfigService),
);
const sign = (role: string, secret = SECRET) =>
  jwt.sign({ sub: 'u-1', role, email: 'a@b.c' }, secret);

function context(token?: string) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(tokens);

  it.each(['user', 'admin'])('lets a %s in and sets request.user', async (role) => {
    const { ctx, request } = context(sign(role));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'u-1', role });
  });

  it.each([
    ['no token', undefined],
    ['a bad signature', sign('user', 'other-secret')],
    ['an unknown role', sign('superuser')],
  ])('rejects %s with 401', async (_, token) => {
    await expect(guard.canActivate(context(token).ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard(tokens);

  it('lets an admin in', async () => {
    await expect(guard.canActivate(context(sign('admin')).ctx)).resolves.toBe(true);
  });

  it('rejects a signed-in user with 403', async () => {
    await expect(guard.canActivate(context(sign('user')).ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects no token with 401', async () => {
    await expect(guard.canActivate(context().ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
