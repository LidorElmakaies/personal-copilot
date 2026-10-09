import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RemindersController } from '../src/api/controllers/reminders.controller';
import { ReminderService } from '../src/application/reminder.service';
import {
  REMINDER_REPOSITORY,
  REMINDER_SCHEDULER,
  REMINDER_SERVICE,
  USER_LOCATION_READER,
} from '../src/tokens';
import type { Reminder } from '../src/models/reminder';
import type { Coordinates } from '../src/models/user-location';
import { InMemoryReminderRepository } from './in-memory-reminder.repository';

describe('reminders API (reminders)', () => {
  let app: INestApplication;
  let base: string;
  let repo: InMemoryReminderRepository;
  /** Stands in for users.profiles: who has sent a location. */
  let locations: Map<string, Coordinates>;

  beforeEach(async () => {
    repo = new InMemoryReminderRepository();
    locations = new Map();
    const moduleRef = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [
        { provide: REMINDER_SERVICE, useClass: ReminderService },
        { provide: REMINDER_REPOSITORY, useValue: repo },
        {
          // Scheduling has its own spec (reminder-scheduler.service.spec.ts); here it changes nothing.
          provide: REMINDER_SCHEDULER,
          useValue: {
            schedule: (r: Reminder) => Promise.resolve(r),
            cancel: () => Promise.resolve(),
          },
        },
        {
          provide: USER_LOCATION_READER,
          useValue: {
            findByUserId: (id: string) =>
              Promise.resolve(locations.get(id) ?? null),
          },
        },
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

  const settings = { offsetMinutes: 90 };
  const call = (
    method: 'GET' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    userId: string | null = 'user-1',
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const put = (body: unknown, userId?: string) =>
    call('PUT', '/reminders/shabbat-candles', body, userId);
  const knowLocation = (userId = 'user-1') =>
    locations.set(userId, { lat: 32.1782, lon: 34.9076, tz: 'Asia/Jerusalem' });

  it('lists nothing for a user without reminders', async () => {
    const res = await call('GET', '/reminders');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('turns the candle-lighting reminder on and returns it', async () => {
    knowLocation();
    const res = await put(settings);

    expect(res.status).toBe(200);
    const expected = {
      type: 'shabbat_candles',
      offsetMinutes: 90,
      enabled: true,
      nextFireAt: null,
      waitingForLocation: false,
    };
    expect(await res.json()).toEqual(expected);
    expect(await (await call('GET', '/reminders')).json()).toEqual([expected]);
  });

  it('saves a reminder before the location is known, and says it is waiting for one', async () => {
    expect(await (await put(settings)).json()).toMatchObject({
      waitingForLocation: true,
    });

    knowLocation();
    expect(await (await call('GET', '/reminders')).json()).toEqual([
      expect.objectContaining({ waitingForLocation: false }),
    ]);
  });

  it('keeps one row per user: a second PUT updates it', async () => {
    await put(settings);
    const res = await put({ offsetMinutes: 30 });

    expect(await res.json()).toMatchObject({ offsetMinutes: 30 });
    expect(repo.rows.size).toBe(1);
  });

  it('ignores a location in the body — it comes from the profile', async () => {
    const res = await put({
      ...settings,
      lat: 32,
      lon: 34.8,
      tz: 'Asia/Jerusalem',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).not.toHaveProperty('lat');
  });

  it('DELETE turns it off but keeps the settings, idempotently', async () => {
    await put(settings);

    expect((await call('DELETE', '/reminders/shabbat-candles')).status).toBe(
      204,
    );
    expect((await call('DELETE', '/reminders/shabbat-candles')).status).toBe(
      204,
    );
    expect(await (await call('GET', '/reminders')).json()).toEqual([
      expect.objectContaining({ enabled: false, offsetMinutes: 90 }),
    ]);
  });

  it('PUT after DELETE turns it back on', async () => {
    await put(settings);
    await call('DELETE', '/reminders/shabbat-candles');
    expect(await (await put(settings)).json()).toMatchObject({ enabled: true });
  });

  it('DELETE without a reminder is a 204 no-op', async () => {
    expect((await call('DELETE', '/reminders/shabbat-candles')).status).toBe(
      204,
    );
    expect(repo.rows.size).toBe(0);
  });

  it("only ever sees the forwarded user's own reminders", async () => {
    await put(settings, 'user-1');
    await call('DELETE', '/reminders/shabbat-candles', undefined, 'user-2');

    expect(
      await (await call('GET', '/reminders', undefined, 'user-2')).json(),
    ).toEqual([]);
    expect(repo.rows.get('user-1:shabbat_candles')?.enabled).toBe(true);
  });

  it('ignores a userId or enabled flag in the body', async () => {
    await put({ ...settings, userId: 'attacker', enabled: false });
    expect(repo.rows.get('user-1:shabbat_candles')).toMatchObject({
      userId: 'user-1',
      enabled: true,
    });
    expect(repo.rows.has('attacker:shabbat_candles')).toBe(false);
  });

  it.each([
    ['GET', '/reminders'],
    ['PUT', '/reminders/shabbat-candles'],
    ['DELETE', '/reminders/shabbat-candles'],
  ] as const)(
    '%s %s answers 401 without a forwarded user id',
    async (method, path) => {
      const res = await call(
        method,
        path,
        method === 'PUT' ? settings : undefined,
        null,
      );
      expect(res.status).toBe(401);
      expect(repo.rows.size).toBe(0);
    },
  );

  it.each([
    ['no body', {}],
    ['a zero offset', { offsetMinutes: 0 }],
    ['an offset over a day', { offsetMinutes: 1441 }],
    ['a fractional offset', { offsetMinutes: 1.5 }],
    ['an offset as a string', { offsetMinutes: '90' }],
  ])('PUT rejects %s with 400', async (_name, body) => {
    expect((await put(body)).status).toBe(400);
    expect(repo.rows.size).toBe(0);
  });
});
