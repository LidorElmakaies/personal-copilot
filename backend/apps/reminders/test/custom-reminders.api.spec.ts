import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReminderOccurrences } from '@app/jewish-calendar';
import { CustomRemindersController } from '../src/api/controllers/custom-reminders.controller';
import {
  CustomReminderService,
  MAX_REMINDERS_PER_USER,
} from '../src/application/custom-reminder.service';
import {
  CUSTOM_REMINDER_REPOSITORY,
  CUSTOM_REMINDER_SERVICE,
  REMINDER_OCCURRENCES,
} from '../src/tokens';
import { InMemoryCustomReminderRepository } from './in-memory-custom-reminder.repository';

// Over the real ReminderOccurrences: its rules have their own spec (libs/jewish-calendar).
describe('custom reminders API (reminders)', () => {
  let app: INestApplication;
  let base: string;
  let repo: InMemoryCustomReminderRepository;

  beforeEach(async () => {
    repo = new InMemoryCustomReminderRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomRemindersController],
      providers: [
        { provide: CUSTOM_REMINDER_SERVICE, useClass: CustomReminderService },
        { provide: CUSTOM_REMINDER_REPOSITORY, useValue: repo },
        { provide: REMINDER_OCCURRENCES, useValue: new ReminderOccurrences() },
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

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
  const grandma = {
    title: 'Call Grandma',
    hour: 19,
    minute: 30,
    repeat: 'once',
    start: '2026-10-21',
  };
  const create = async (body: unknown = grandma, userId?: string) => {
    const res = await call('POST', '/reminders/custom', body, userId);
    return { res, json: (await res.json()) as Record<string, unknown> };
  };
  const list = async (
    from = '2026-10-01',
    to = '2026-10-31',
    userId?: string,
  ) =>
    (await (
      await call(
        'GET',
        `/reminders/custom?from=${from}&to=${to}`,
        undefined,
        userId,
      )
    ).json()) as { id: string; title: string; dates: string[] }[];

  describe('create', () => {
    it('saves it and returns it, Gregorian unless told otherwise, without the user id', async () => {
      const { res, json } = await create();
      expect(res.status).toBe(201);
      expect(json).toEqual({
        id: expect.any(String) as string,
        ...grandma,
        calendar: 'gregorian',
        skipped: [],
      });
      expect(json).not.toHaveProperty('userId');
    });

    it('takes a Hebrew title, trimmed', async () => {
      const { res, json } = await create({
        ...grandma,
        title: '  יום הולדת לנועה  ',
      });
      expect(res.status).toBe(201);
      expect(json.title).toBe('יום הולדת לנועה');
    });

    it.each([
      ['no title', { ...grandma, title: undefined }],
      ['an empty title', { ...grandma, title: '   ' }],
      ['a title past 60 characters', { ...grandma, title: 'a'.repeat(61) }],
      ['other letters in the title', { ...grandma, title: 'Привет' }],
      ['markup in the title', { ...grandma, title: '<b>hi</b>' }],
      ['two spaces in a row', { ...grandma, title: 'Call  Grandma' }],
      ['hour 24', { ...grandma, hour: 24 }],
      ['a fractional minute', { ...grandma, minute: 7.5 }],
      ['an unknown repeat', { ...grandma, repeat: 'weekly' }],
      ['an unknown calendar', { ...grandma, calendar: 'julian' }],
      ["a date that doesn't exist", { ...grandma, start: '2026-02-30' }],
      ['a date with a time', { ...grandma, start: '2026-10-21T10:00:00Z' }],
      ['no start', { ...grandma, start: undefined }],
    ])('refuses %s (400)', async (_name, body) => {
      expect((await create(body)).res.status).toBe(400);
      expect(repo.rows.size).toBe(0);
    });

    it(`allows at most ${MAX_REMINDERS_PER_USER} per user (422)`, async () => {
      for (let i = 0; i < MAX_REMINDERS_PER_USER; i++)
        await repo.create('user-1', {
          ...grandma,
          repeat: 'once',
          calendar: 'gregorian',
        });
      expect((await create()).res.status).toBe(422);
      expect((await create(grandma, 'user-2')).res.status).toBe(201);
    });
  });

  describe('list', () => {
    it('gives every reminder with the days it falls on in the range', async () => {
      await create({
        ...grandma,
        title: 'Take vitamins',
        repeat: 'daily',
        start: '2026-10-29',
      });
      await create({
        ...grandma,
        title: "Noa's birthday",
        repeat: 'yearly',
        calendar: 'hebrew',
        start: '2024-11-16', // 15 Cheshvan 5785
      });
      await create(); // once, 21 Oct

      expect(
        (await list('2026-10-01', '2026-10-31')).map((r) => [r.title, r.dates]),
      ).toEqual([
        ['Take vitamins', ['2026-10-29', '2026-10-30', '2026-10-31']],
        ["Noa's birthday", ['2026-10-26']], // 15 Cheshvan 5787
        ['Call Grandma', ['2026-10-21']],
      ]);
      expect(
        (await list('2026-11-01', '2026-11-30')).find(
          (r) => r.title === 'Call Grandma',
        )?.dates,
      ).toEqual([]);
    });

    it.each([
      ['no range', ''],
      ['from after to', '?from=2026-10-31&to=2026-10-01'],
      ['more than 400 days', '?from=2026-01-01&to=2027-02-05'],
      ['a bad date', '?from=2026-13-01&to=2026-12-31'],
    ])('refuses %s (400)', async (_name, query) => {
      expect((await call('GET', `/reminders/custom${query}`)).status).toBe(400);
    });

    it("shows only the user's own", async () => {
      await create(grandma, 'user-2');
      expect(await list()).toEqual([]);
    });
  });

  describe('edit', () => {
    it('changes only the fields sent', async () => {
      const { json } = await create();
      const res = await call('PATCH', `/reminders/custom/${String(json.id)}`, {
        hour: 20,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ...grandma, hour: 20 });
    });

    it('refuses nothing to change (400) and a bad field (400)', async () => {
      const { json } = await create();
      const path = `/reminders/custom/${String(json.id)}`;
      expect((await call('PATCH', path, {})).status).toBe(400);
      expect((await call('PATCH', path, { minute: 60 })).status).toBe(400);
    });
  });

  describe('delete', () => {
    it('deletes it: 204, then 404', async () => {
      const { json } = await create();
      const path = `/reminders/custom/${String(json.id)}`;
      expect((await call('DELETE', path)).status).toBe(204);
      expect((await call('DELETE', path)).status).toBe(404);
      expect(await list()).toEqual([]);
    });
  });

  describe('skip ("only this day")', () => {
    const vitamins = {
      ...grandma,
      title: 'Take vitamins',
      repeat: 'daily',
      start: '2026-10-01',
    };

    it('leaves that one day out, and is idempotent', async () => {
      const { json } = await create(vitamins);
      const path = `/reminders/custom/${String(json.id)}/skip`;
      const res = await call('POST', path, { date: '2026-10-20' });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ skipped: ['2026-10-20'] });
      expect((await call('POST', path, { date: '2026-10-20' })).status).toBe(
        200,
      );

      const [r] = await list('2026-10-19', '2026-10-21');
      expect(r.dates).toEqual(['2026-10-19', '2026-10-21']);
    });

    it("refuses a day it doesn't fall on (422) and a bad date (400)", async () => {
      const { json } = await create(); // once, 21 Oct
      const path = `/reminders/custom/${String(json.id)}/skip`;
      expect((await call('POST', path, { date: '2026-10-22' })).status).toBe(
        422,
      );
      expect((await call('POST', path, { date: 'tomorrow' })).status).toBe(400);
    });
  });

  describe("someone else's reminder", () => {
    it('is a 404 for every change, and stays as it was', async () => {
      const { json } = await create(grandma, 'user-2');
      const path = `/reminders/custom/${String(json.id)}`;
      expect((await call('PATCH', path, { hour: 8 })).status).toBe(404);
      expect((await call('DELETE', path)).status).toBe(404);
      expect(
        (await call('POST', `${path}/skip`, { date: '2026-10-21' })).status,
      ).toBe(404);
      expect(repo.rows.get(String(json.id))).toMatchObject({
        hour: 19,
        skipped: [],
      });
    });

    it('an id that is not a UUID is a 404 too', async () => {
      expect(
        (await call('DELETE', '/reminders/custom/not-a-uuid')).status,
      ).toBe(404);
    });
  });

  it("goes with the account (the table's ON DELETE CASCADE)", async () => {
    await create();
    repo.deleteUser('user-1');
    expect(await list()).toEqual([]);
  });
});
