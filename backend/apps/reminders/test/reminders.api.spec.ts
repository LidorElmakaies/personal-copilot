import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RemindersController } from '../src/api/controllers/reminders.controller';
import { ReminderService } from '../src/application/reminder.service';
import { REMINDER_REPOSITORY, REMINDER_SERVICE } from '../src/tokens';
import { InMemoryReminderRepository } from './in-memory-reminder.repository';

describe('reminders API (reminders)', () => {
  let app: INestApplication;
  let base: string;
  let repo: InMemoryReminderRepository;

  beforeEach(async () => {
    repo = new InMemoryReminderRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [
        { provide: REMINDER_SERVICE, useClass: ReminderService },
        { provide: REMINDER_REPOSITORY, useValue: repo },
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

  const telAviv = {
    offsetMinutes: 90,
    lat: 32.0853,
    lon: 34.7818,
    tz: 'Asia/Jerusalem',
  };
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

  it('lists nothing for a user without reminders', async () => {
    const res = await call('GET', '/reminders');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('turns the candle-lighting reminder on and returns it', async () => {
    const res = await put(telAviv);

    expect(res.status).toBe(200);
    const expected = {
      type: 'shabbat_candles',
      ...telAviv,
      enabled: true,
      nextFireAt: null,
    };
    expect(await res.json()).toEqual(expected);
    expect(await (await call('GET', '/reminders')).json()).toEqual([expected]);
  });

  it('keeps one row per user: a second PUT updates it', async () => {
    await put(telAviv);
    const res = await put({ ...telAviv, offsetMinutes: 30, lat: 31.7683 });

    expect(await res.json()).toMatchObject({ offsetMinutes: 30, lat: 31.7683 });
    expect(repo.rows.size).toBe(1);
  });

  it('DELETE turns it off but keeps the settings, idempotently', async () => {
    await put(telAviv);

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
    await put(telAviv);
    await call('DELETE', '/reminders/shabbat-candles');
    expect(await (await put(telAviv)).json()).toMatchObject({ enabled: true });
  });

  it('DELETE without a reminder is a 204 no-op', async () => {
    expect((await call('DELETE', '/reminders/shabbat-candles')).status).toBe(
      204,
    );
    expect(repo.rows.size).toBe(0);
  });

  it("only ever sees the forwarded user's own reminders", async () => {
    await put(telAviv, 'user-1');
    await call('DELETE', '/reminders/shabbat-candles', undefined, 'user-2');

    expect(
      await (await call('GET', '/reminders', undefined, 'user-2')).json(),
    ).toEqual([]);
    expect(repo.rows.get('user-1:shabbat_candles')?.enabled).toBe(true);
  });

  it('ignores a userId or enabled flag in the body', async () => {
    await put({ ...telAviv, userId: 'attacker', enabled: false });
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
        method === 'PUT' ? telAviv : undefined,
        null,
      );
      expect(res.status).toBe(401);
      expect(repo.rows.size).toBe(0);
    },
  );

  it.each([
    ['no body', {}],
    ['a zero offset', { ...telAviv, offsetMinutes: 0 }],
    ['an offset over a day', { ...telAviv, offsetMinutes: 1441 }],
    ['a fractional offset', { ...telAviv, offsetMinutes: 1.5 }],
    ['an offset as a string', { ...telAviv, offsetMinutes: '90' }],
    ['a latitude out of range', { ...telAviv, lat: 91 }],
    ['a longitude out of range', { ...telAviv, lon: -181 }],
    ['a latitude as a string', { ...telAviv, lat: '32.08' }],
    ['an unknown time zone', { ...telAviv, tz: 'Mars/Olympus' }],
    ['a missing time zone', { ...telAviv, tz: undefined }],
  ])('PUT rejects %s with 400', async (_name, body) => {
    expect((await put(body)).status).toBe(400);
    expect(repo.rows.size).toBe(0);
  });
});
