import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CalendarModule } from '../src/calendar.module';

describe('GET /calendar/shabbat', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CalendarModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    ); // same as main.ts
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(() => app.close());

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
