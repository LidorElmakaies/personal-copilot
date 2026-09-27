import type { INestApplication } from '@nestjs/common';
import { CalendarProxyModule } from '../src/calendar-proxy/calendar-proxy.module';
import { CALENDAR_SERVICE_CLIENT } from '../src/tokens';
import { bootProxy } from './proxy-app';

describe('GET /calendar/shabbat (gateway)', () => {
  let app: INestApplication;

  afterEach(() => app?.close());

  it('forwards only lat/lon/tz and relays the response verbatim', async () => {
    const body = { candleLighting: '2026-10-02T15:04:00.000Z', isNow: false };
    const booted = await bootProxy(
      CalendarProxyModule,
      CALENDAR_SERVICE_CLIENT,
      { status: 200, body },
    );
    app = booted.app;

    const res = await fetch(
      `${booted.base}/calendar/shabbat?lat=32.08&lon=34.78&tz=Asia/Jerusalem&extra=1`,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
    expect(booted.forward).toHaveBeenCalledWith({
      method: 'GET',
      path: '/calendar/shabbat',
      query: { lat: '32.08', lon: '34.78', tz: 'Asia/Jerusalem' },
    });
  });

  it("relays Calendar Service's 400 unchanged", async () => {
    const error = {
      statusCode: 400,
      message: ['lat must be a latitude string or number'],
    };
    const booted = await bootProxy(
      CalendarProxyModule,
      CALENDAR_SERVICE_CLIENT,
      { status: 400, body: error },
    );
    app = booted.app;

    const res = await fetch(`${booted.base}/calendar/shabbat?lat=99`);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(error);
  });
});
