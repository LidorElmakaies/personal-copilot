import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { AuthKernelModule } from '@app/auth-kernel';
import { isUserStateMessage, KAFKA_TOPICS } from '@app/kafka-contracts';
import { AuthController } from '../src/api/controllers/auth.controller';
import { UsersController } from '../src/api/controllers/users.controller';
import { AuthService } from '../src/application/auth.service';
import { ProfileService } from '../src/application/profile.service';
import { SaltPepperSha256Hasher } from '../src/infrastructure/hashing/salt-pepper-sha256.hasher';
import {
  AUTH_SERVICE,
  PASSWORD_HASHER,
  PROFILE_REPOSITORY,
  PROFILE_SERVICE,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from '../src/tokens';
import { InMemoryStore } from './in-memory-store';

describe('accounts and profiles (users)', () => {
  let app: INestApplication;
  let base: string;
  let store: InMemoryStore;

  beforeEach(async () => {
    store = new InMemoryStore();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'test', PASSWORD_PEPPER: 'pepper' })],
        }),
        AuthKernelModule,
      ],
      controllers: [AuthController, UsersController],
      providers: [
        { provide: AUTH_SERVICE, useClass: AuthService },
        { provide: PROFILE_SERVICE, useClass: ProfileService },
        { provide: USER_REPOSITORY, useValue: store.userRepository },
        { provide: PROFILE_REPOSITORY, useValue: store.profileRepository },
        {
          provide: REFRESH_TOKEN_REPOSITORY,
          useValue: store.refreshTokenRepository,
        },
        { provide: PASSWORD_HASHER, useClass: SaltPepperSha256Hasher },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    ); // same as main.ts
    await app.listen(0);
    base = await app.getUrl();
  });

  afterEach(() => app.close());

  const send = (
    method: string,
    path: string,
    body?: unknown,
    userId?: string,
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function register(body: object = {}): Promise<string> {
    const res = await send('POST', '/auth/register', {
      email: 'a@example.com',
      password: 'password1',
      ...body,
    });
    expect(res.status).toBe(201);
    const { access_token } = (await res.json()) as { access_token: string };
    return (jwt.decode(access_token) as { sub: string }).sub;
  }

  type Tokens = { access_token: string; refresh_token: string };
  const claims = (tokens: Tokens) =>
    jwt.decode(tokens.access_token) as { sub: string; email: string };
  const login = (email: string, password: string) =>
    send('POST', '/auth/login', { email, password });
  const refresh = (refresh_token: string) =>
    send('POST', '/auth/refresh', { refresh_token });

  describe('login, refresh, logout', () => {
    it('logs in with the email in any case, and the token carries the account', async () => {
      const userId = await register();
      const res = await login('A@Example.com', 'password1');
      expect(res.status).toBe(200);
      expect(claims((await res.json()) as Tokens)).toMatchObject({
        sub: userId,
        email: 'a@example.com',
        role: 'user',
      });
    });

    it.each([
      ['a wrong password', 'a@example.com', 'wrong'],
      ['an unknown email', 'b@example.com', 'password1'],
    ])('answers 401 for %s, with the same message', async (_n, email, pw) => {
      await register();
      const res = await login(email, pw);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({
        message: 'Invalid email or password',
      });
    });

    it('rejects registering an email twice, in any case, with 409', async () => {
      await register();
      expect(
        (
          await send('POST', '/auth/register', {
            email: 'A@EXAMPLE.COM',
            password: 'password1',
          })
        ).status,
      ).toBe(409);
    });

    it('refresh rotates: the new token works, the used one never again', async () => {
      await register();
      const first = (await (
        await login('a@example.com', 'password1')
      ).json()) as Tokens;

      const res = await refresh(first.refresh_token);
      expect(res.status).toBe(200);
      const second = (await res.json()) as Tokens;
      expect(second.refresh_token).not.toBe(first.refresh_token);

      expect((await refresh(first.refresh_token)).status).toBe(401);
      expect((await refresh(second.refresh_token)).status).toBe(200);
    });

    it('refresh answers 401 for a made-up token', async () => {
      expect((await refresh('not-a-token')).status).toBe(401);
    });

    it('refresh answers 401 for an expired token', async () => {
      await register();
      const { refresh_token } = (await (
        await login('a@example.com', 'password1')
      ).json()) as Tokens;
      for (const token of store.refreshTokens.values())
        token.expiresAt = new Date(Date.now() - 1000);
      expect((await refresh(refresh_token)).status).toBe(401);
    });

    it('logout revokes the refresh token; an unknown one is a no-op', async () => {
      await register();
      const { refresh_token } = (await (
        await login('a@example.com', 'password1')
      ).json()) as Tokens;

      expect(
        (await send('POST', '/auth/logout', { refresh_token })).status,
      ).toBe(204);
      expect((await refresh(refresh_token)).status).toBe(401);
      expect(
        (await send('POST', '/auth/logout', { refresh_token: 'unknown' }))
          .status,
      ).toBe(204);
    });

    it("a deleted account's refresh token no longer works", async () => {
      await register();
      const { refresh_token } = (await (
        await login('a@example.com', 'password1')
      ).json()) as Tokens;
      await send('DELETE', '/auth/account', {
        email: 'a@example.com',
        currentPassword: 'password1',
      });
      expect((await refresh(refresh_token)).status).toBe(401);
    });
  });

  describe('POST /auth/account', () => {
    const update = (body: object) =>
      send('POST', '/auth/account', {
        email: 'a@example.com',
        currentPassword: 'password1',
        ...body,
      });

    it('changes the email and password together, and the new tokens carry the new email', async () => {
      const userId = await register();

      const res = await update({
        newEmail: 'New@Example.com',
        newPassword: 'password2',
      });

      expect(res.status).toBe(200);
      expect(claims((await res.json()) as Tokens)).toMatchObject({
        sub: userId,
        email: 'new@example.com',
      });
      expect((await login('new@example.com', 'password2')).status).toBe(200);
      expect((await login('new@example.com', 'password1')).status).toBe(401);
      expect((await login('a@example.com', 'password2')).status).toBe(401);
    });

    it('a new password signs out every other session; the returned tokens keep working', async () => {
      await register();
      const otherDevice = (await (
        await login('a@example.com', 'password1')
      ).json()) as Tokens;

      const res = await update({ newPassword: 'password2' });
      const thisDevice = (await res.json()) as Tokens;

      expect((await refresh(otherDevice.refresh_token)).status).toBe(401);
      expect((await refresh(thisDevice.refresh_token)).status).toBe(200);
    });

    it('an email-only change keeps the other sessions', async () => {
      await register();
      const otherDevice = (await (
        await login('a@example.com', 'password1')
      ).json()) as Tokens;

      await update({ newEmail: 'new@example.com' });

      expect((await refresh(otherDevice.refresh_token)).status).toBe(200);
    });

    it('a password-only change still returns fresh tokens', async () => {
      await register();
      const res = await update({ newPassword: 'password2' });
      expect(res.status).toBe(200);
      expect(claims((await res.json()) as Tokens).email).toBe('a@example.com');
      expect((await login('a@example.com', 'password2')).status).toBe(200);
    });

    it.each([
      ['neither newEmail nor newPassword', {}, 400],
      [
        'a wrong current password',
        { currentPassword: 'x', newPassword: 'password2' },
        401,
      ],
      ['a short new password', { newPassword: 'short' }, 400],
    ])('rejects %s and changes nothing', async (_n, body, status) => {
      await register();
      expect((await update(body)).status).toBe(status);
      expect((await login('a@example.com', 'password1')).status).toBe(200);
    });

    it('keeping the same email (in another case) is not a conflict', async () => {
      await register();
      expect((await update({ newEmail: 'A@EXAMPLE.com' })).status).toBe(200);
    });

    it("rejects another account's email with 409, password untouched", async () => {
      await register();
      await register({ email: 'b@example.com' });
      expect(
        (await update({ newEmail: 'B@example.com', newPassword: 'password2' }))
          .status,
      ).toBe(409);
      expect((await login('a@example.com', 'password1')).status).toBe(200);
    });
  });

  describe('register', () => {
    it('creates the profile with the optional details and announces it as version 1', async () => {
      const userId = await register({
        firstName: '  Lidor ',
        lastName: 'Cohen',
        phone: '+972501234567',
      });

      const res = await send('GET', '/users/me', undefined, userId);
      expect(await res.json()).toEqual({
        firstName: 'Lidor',
        lastName: 'Cohen',
        phone: '+972501234567',
        location: null,
      });
      expect(store.stateEventsFor(userId)).toEqual([
        {
          userId,
          version: 1,
          firstName: 'Lidor',
          lastName: 'Cohen',
          phone: '+972501234567',
          location: null,
        },
      ]);
    });

    it.each([
      ['a Hebrew name', 'לידור', 'כהן'],
      ['two-word names', 'Bar Lev', 'בר לב'],
    ])('accepts %s', async (_name, firstName, lastName) => {
      const userId = await register({ firstName, lastName });
      const res = await send('GET', '/users/me', undefined, userId);
      expect(await res.json()).toMatchObject({ firstName, lastName });
    });

    it('works with just email and password', async () => {
      const userId = await register();
      expect(store.profiles.get(userId)).toMatchObject({
        firstName: null,
        lastName: null,
        phone: null,
      });
    });

    it.each([
      ['a local phone number', { phone: '0501234567' }],
      ['an empty first name', { firstName: '   ' }],
      ['a last name over 100 chars', { lastName: 'a'.repeat(101) }],
      ['a digit in a name', { firstName: 'Lidor1' }],
      ['a hyphen in a name', { lastName: 'Bar-Lev' }],
      ['an accented letter', { firstName: 'José' }],
      ['Hebrew niqqud', { firstName: 'שָׁלוֹם' }],
      ['an Arabic name', { firstName: 'علي' }],
      ['a double space', { lastName: 'Bar  Lev' }],
    ])('rejects %s with 400 and creates nothing', async (_name, details) => {
      const res = await send('POST', '/auth/register', {
        email: 'a@example.com',
        password: 'password1',
        ...details,
      });
      expect(res.status).toBe(400);
      expect(store.users.size).toBe(0);
      expect(store.events).toEqual([]);
    });
  });

  describe('GET/PATCH /users/me', () => {
    it('changes only the fields sent, null clears one, and each change is a new version', async () => {
      const userId = await register({
        firstName: 'Lidor',
        phone: '+972501234567',
      });

      const res = await send(
        'PATCH',
        '/users/me',
        { lastName: 'Cohen', phone: null },
        userId,
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        firstName: 'Lidor',
        lastName: 'Cohen',
        phone: null,
        location: null,
      });
      expect(
        store
          .stateEventsFor(userId)
          .map((e) => (e as { version: number }).version),
      ).toEqual([1, 2]);
    });

    it('rejects a PATCH with no fields', async () => {
      const userId = await register();
      const res = await send('PATCH', '/users/me', {}, userId);
      expect(res.status).toBe(400);
      expect(store.stateEventsFor(userId)).toHaveLength(1);
    });

    it('ignores a userId or version in the body', async () => {
      const userId = await register();
      await send(
        'PATCH',
        '/users/me',
        { firstName: 'A', userId: 'other', version: 99 },
        userId,
      );
      expect(store.profiles.get(userId)?.version).toBe(2);
      expect(store.profiles.has('other')).toBe(false);
    });

    it('answers 404 for a user that no longer exists (a still-valid token after delete)', async () => {
      expect((await send('GET', '/users/me', undefined, 'gone')).status).toBe(
        404,
      );
      expect(
        (await send('PATCH', '/users/me', { firstName: 'A' }, 'gone')).status,
      ).toBe(404);
      expect(
        (
          await send(
            'PUT',
            '/users/me/location',
            { lat: 32, lon: 34.8, tz: 'Asia/Jerusalem' },
            'gone',
          )
        ).status,
      ).toBe(404);
      expect(store.profiles.has('gone')).toBe(false);
    });

    it.each([
      ['GET', '/users/me', undefined],
      ['PATCH', '/users/me', { firstName: 'A' }],
      [
        'PUT',
        '/users/me/location',
        { lat: 32, lon: 34.8, tz: 'Asia/Jerusalem' },
      ],
    ])(
      '%s %s answers 401 without a forwarded user id',
      async (method, path, body) => {
        expect((await send(method, path, body)).status).toBe(401);
      },
    );
  });

  describe('PUT /users/me/location', () => {
    it('saves the location and announces the full state with it', async () => {
      const userId = await register({ firstName: 'Lidor' });

      const res = await send(
        'PUT',
        '/users/me/location',
        { lat: 32.1782, lon: 34.9076, tz: 'Asia/Jerusalem' },
        userId,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { location: { updatedAt: string } };
      expect(body).toMatchObject({
        firstName: 'Lidor',
        location: { lat: 32.1782, lon: 34.9076, tz: 'Asia/Jerusalem' },
      });
      const [, latest] = store.stateEventsFor(userId);
      expect(isUserStateMessage(latest)).toBe(true);
      expect(latest).toMatchObject({
        version: 2,
        firstName: 'Lidor',
        location: {
          lat: 32.1782,
          lon: 34.9076,
          tz: 'Asia/Jerusalem',
          updatedAt: body.location.updatedAt,
        },
      });
    });

    it.each([
      ['a latitude out of range', { lat: 91, lon: 34.8, tz: 'Asia/Jerusalem' }],
      [
        'a latitude as a string',
        { lat: '32', lon: 34.8, tz: 'Asia/Jerusalem' },
      ],
      ['an unknown time zone', { lat: 32, lon: 34.8, tz: 'Mars/Base' }],
      ['a missing longitude', { lat: 32, tz: 'Asia/Jerusalem' }],
    ])('rejects %s with 400', async (_name, body) => {
      const userId = await register();
      expect(
        (await send('PUT', '/users/me/location', body, userId)).status,
      ).toBe(400);
      expect(store.stateEventsFor(userId)).toHaveLength(1);
    });
  });

  describe('DELETE /auth/account', () => {
    it('deletes the account and profile and publishes a tombstone', async () => {
      const userId = await register();

      const res = await send('DELETE', '/auth/account', {
        email: 'a@example.com',
        currentPassword: 'password1',
      });

      expect(res.status).toBe(204);
      expect(store.users.has(userId)).toBe(false);
      expect(store.profiles.has(userId)).toBe(false);
      expect(store.events.at(-1)).toEqual({
        topic: KAFKA_TOPICS.USER_STATE,
        key: userId,
        payload: null,
      });
      expect(
        (
          await send('POST', '/auth/login', {
            email: 'a@example.com',
            password: 'password1',
          })
        ).status,
      ).toBe(401);
    });

    it('rejects a wrong password with 401 and keeps the account', async () => {
      const userId = await register();
      const res = await send('DELETE', '/auth/account', {
        email: 'a@example.com',
        currentPassword: 'wrong',
      });
      expect(res.status).toBe(401);
      expect(store.users.has(userId)).toBe(true);
      expect(store.events).toHaveLength(1);
    });
  });
});
