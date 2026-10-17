import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CalendarModule } from '../src/calendar/calendar.module';

// Both routes are served by Gateway itself, from @app/jewish-calendar.
let app: INestApplication;
let base: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [CalendarModule],
  }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); // same as main.ts
  await app.listen(0);
  base = await app.getUrl();
});

afterAll(() => app.close());

describe('GET /calendar/shabbat', () => {
  const get = (query: string) => fetch(`${base}/calendar/shabbat?${query}`);

  it('returns ISO times, parasha, holidays and isNow for a valid location', async () => {
    const res = await get('lat=32.0853&lon=34.7818&tz=Asia/Jerusalem');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & {
      candleLighting: string;
      havdalah: string;
    };
    expect(Object.keys(body).sort()).toEqual([
      'candleLighting',
      'havdalah',
      'holidays',
      'isNow',
      'parasha',
    ]);
    expect(new Date(body.candleLighting).getTime()).toBeLessThan(
      new Date(body.havdalah).getTime(),
    );
    expect(typeof body.isNow).toBe('boolean');
  });

  it.each([
    ['latitude out of range', 'lat=91&lon=34.7&tz=Asia/Jerusalem'],
    ['longitude out of range', 'lat=32&lon=181&tz=Asia/Jerusalem'],
    ['unknown time zone', 'lat=32&lon=34.7&tz=Mars/Olympus'],
    ['missing time zone', 'lat=32&lon=34.7'],
    ['non-numeric latitude', 'lat=abc&lon=34.7&tz=Asia/Jerusalem'],
  ])('rejects %s with 400', async (_name, query) => {
    expect((await get(query)).status).toBe(400);
  });

  it('answers 422 where the sun never sets', async () => {
    // Midsummer in Tromsø: no sunset, so no candle lighting.
    jest.useFakeTimers({
      now: new Date('2026-06-21T12:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'],
    });
    try {
      expect((await get('lat=69.6492&lon=18.9553&tz=Europe/Oslo')).status).toBe(
        422,
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('GET /calendar/month', () => {
  const get = (query: string) => fetch(`${base}/calendar/month?${query}`);
  const TEL_AVIV = 'lat=32.0853&lon=34.7818&tz=Asia/Jerusalem';

  it('returns every day with its Hebrew date, events, parasha and ISO times', async () => {
    const res = await get(`year=2026&month=9&${TEL_AVIV}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      year: number;
      month: number;
      days: {
        date: string;
        hebrew: Record<string, unknown>;
        events: { kind: string; name: { en: string; he: string } }[];
        parasha: unknown;
        times: { kind: string; at: string }[];
      }[];
    };
    expect(body.year).toBe(2026);
    expect(body.month).toBe(9);
    expect(body.days).toHaveLength(30);
    const kippur = body.days.find((d) => d.date === '2026-09-21')!;
    expect(Object.keys(kippur).sort()).toEqual([
      'date',
      'events',
      'hebrew',
      'parasha',
      'times',
    ]);
    expect(kippur.events).toContainEqual({
      kind: 'yomTov',
      name: { en: 'Yom Kippur', he: 'יום כיפור' },
    });
    expect(kippur.times.map((t) => t.kind)).toEqual(['fastEnds']);
    expect(kippur.times[0].at).toMatch(/^2026-09-21T\d{2}:\d{2}:00\.000Z$/);
  });

  it.each([
    ['month 0', `year=2026&month=0&${TEL_AVIV}`],
    ['month 13', `year=2026&month=13&${TEL_AVIV}`],
    ['a fractional month', `year=2026&month=1.5&${TEL_AVIV}`],
    ['a year out of range', `year=1800&month=1&${TEL_AVIV}`],
    ['a missing year', `month=1&${TEL_AVIV}`],
    ['a missing location', 'year=2026&month=1'],
    [
      'an unknown time zone',
      'year=2026&month=1&lat=32&lon=34.7&tz=Mars/Olympus',
    ],
  ])('rejects %s with 400', async (_name, query) => {
    expect((await get(query)).status).toBe(400);
  });

  it('answers where the sun never sets, with no times on those days', async () => {
    const res = await get(
      'year=2026&month=6&lat=69.6492&lon=18.9553&tz=Europe/Oslo',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      days: { date: string; times: unknown[] }[];
    };
    expect(body.days.find((d) => d.date === '2026-06-19')!.times).toEqual([]);
  });
});
