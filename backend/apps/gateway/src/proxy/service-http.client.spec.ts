import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { ServiceHttpClient } from './service-http.client';

// A real HTTP server standing in for an internal service; echoes what it received.
describe('ServiceHttpClient', () => {
  let server: Server;
  let baseUrl: string;
  const http = new HttpService(axios.create());

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        const status = req.url?.startsWith('/fail') ? 401 : 200;
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            method: req.method,
            url: req.url,
            body: raw ? (JSON.parse(raw) as unknown) : null,
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('forwards a GET with its query string', async () => {
    const client = new ServiceHttpClient(http, baseUrl, 'calendar_service');
    const res = await client.forward({
      method: 'GET',
      path: '/calendar/shabbat',
      query: { lat: '32.1', tz: 'Asia/Jerusalem' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      method: 'GET',
      url: '/calendar/shabbat?lat=32.1&tz=Asia%2FJerusalem',
    });
  });

  it('forwards a POST body', async () => {
    const client = new ServiceHttpClient(http, baseUrl, 'auth_service');
    const res = await client.forward({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'a@b.c' },
    });
    expect(res.body).toMatchObject({
      method: 'POST',
      body: { email: 'a@b.c' },
    });
  });

  it('relays a 4xx status and body instead of throwing', async () => {
    const client = new ServiceHttpClient(http, baseUrl, 'auth_service');
    const res = await client.forward({ method: 'POST', path: '/fail' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ url: '/fail' });
  });

  it('answers 502 with a service-specific code when the service is down', async () => {
    const client = new ServiceHttpClient(
      http,
      'http://127.0.0.1:1',
      'auth_service',
    );
    const res = await client.forward({ method: 'POST', path: '/auth/login' });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: { code: 'auth_service_unreachable' },
    });
  });
});
