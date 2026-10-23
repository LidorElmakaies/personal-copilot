import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { USER_ROLES } from './interfaces/jwt-service.interface';
import { JsonWebTokenService } from './jsonwebtoken.service';

// Users signs, Gateway verifies: two services, each with its own ConfigService reading JWT_SECRET.
const service = (JWT_SECRET?: string) =>
  new JsonWebTokenService(new ConfigService({ JWT_SECRET }));

describe('JsonWebTokenService across services', () => {
  const users = service('shared-secret');
  const gateway = service('shared-secret');

  it.each(USER_ROLES)(
    'a %s token signed by one verifies in the other, unchanged',
    (role) => {
      const payload = { sub: 'u-1', role, email: 'a@b.c' };
      expect(gateway.verify(users.sign(payload, '15m'))).toEqual(payload);
    },
  );

  it('a token signed with another JWT_SECRET is refused', () => {
    const token = service('other-secret').sign(
      { sub: 'u-1', role: 'user', email: 'a@b.c' },
      '15m',
    );
    expect(gateway.verify(token)).toBeNull();
  });

  it.each([
    ['an expired token', { sub: 'u-1', role: 'user', email: 'a@b.c', exp: 1 }],
    ['an unknown role', { sub: 'u-1', role: 'superuser', email: 'a@b.c' }],
    ['no email', { sub: 'u-1', role: 'user' }],
    ['no subject', { role: 'user', email: 'a@b.c' }],
  ])('refuses %s', (_name, claims) => {
    expect(gateway.verify(jwt.sign(claims, 'shared-secret'))).toBeNull();
  });

  it('without JWT_SECRET it throws instead of signing', () => {
    expect(() =>
      service().sign({ sub: 'u-1', role: 'user', email: 'a@b.c' }, '15m'),
    ).toThrow('JWT_SECRET is not configured');
  });
});
