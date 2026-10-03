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
          useValue: {
            create: () => Promise.resolve(),
            findByTokenHash: () => Promise.resolve(null),
            revoke: () => Promise.resolve(),
          },
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

    it('gives an account from before profiles an empty profile, and creates it on the first write', async () => {
      const legacy = store.addLegacyUser('old@example.com');

      expect(
        await (await send('GET', '/users/me', undefined, legacy.id)).json(),
      ).toEqual({
        firstName: null,
        lastName: null,
        phone: null,
        location: null,
      });
      expect(store.profiles.has(legacy.id)).toBe(false);

      await send('PATCH', '/users/me', { firstName: 'Old' }, legacy.id);
      expect(store.stateEventsFor(legacy.id)).toEqual([
        expect.objectContaining({ version: 1, firstName: 'Old' }),
      ]);
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
