import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CalendarModule } from '../src/calendar.module';

describe('GET /calendar/candle-lighting/next', () => {
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

  const TEL_AVIV = 'lat=32.0853&lon=34.7818&tz=Asia/Jerusalem';
  const get = (query: string) =>
    fetch(`${base}/calendar/candle-lighting/next?${query}`);

  it('returns only the next candle lighting after `after`', async () => {
    // Saturday during Shmini Atzeret → next Friday, Bereshit.
    const res = await get(`${TEL_AVIV}&after=2026-10-03T12:00:00Z`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      candleLighting: '2026-10-09T14:55:00.000Z',
    });
  });

  it('accepts an offset instead of Z', async () => {
    const res = await get(
      `${TEL_AVIV}&after=${encodeURIComponent('2026-10-09T17:54:00+03:00')}`,
    );
    expect(await res.json()).toEqual({
      candleLighting: '2026-10-09T14:55:00.000Z',
    });
  });

  it('defaults `after` to now', async () => {
    const res = await get(TEL_AVIV);
    expect(res.status).toBe(200);
    const { candleLighting } = (await res.json()) as { candleLighting: string };
    expect(new Date(candleLighting).getTime()).toBeGreaterThan(Date.now());
  });

  it('skips the polar summer instead of failing', async () => {
    const res = await get(
      'lat=69.6492&lon=18.9553&tz=Europe/Oslo&after=2026-06-21T12:00:00Z',
    );
    expect(res.status).toBe(200);
    const { candleLighting } = (await res.json()) as { candleLighting: string };
    expect(new Date(candleLighting).getTime()).toBeGreaterThan(
      new Date('2026-07-01T00:00:00Z').getTime(),
    );
  });

  it.each([
    ['no time zone on `after`', `${TEL_AVIV}&after=2026-10-03T12:00:00`],
    ['a date that is not ISO', `${TEL_AVIV}&after=yesterday`],
    ['an invalid location', 'lat=91&lon=34.7&tz=Asia/Jerusalem'],
  ])('rejects %s with 400', async (_name, query) => {
    expect((await get(query)).status).toBe(400);
  });
});
