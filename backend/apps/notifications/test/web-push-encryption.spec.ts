import { execFileSync } from 'child_process';
import { createECDH, randomBytes } from 'crypto';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import https, { createServer, type Server } from 'https';
import type { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import webpush from 'web-push';
import { WebPushLibSender } from '../src/infrastructure/webpush/web-push-lib.sender';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ece = require('http_ece') as {
  decrypt(
    body: Buffer,
    params: { version: string; privateKey: unknown; authSecret: string },
  ): Buffer;
};

interface Captured {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

// Proof that the push service only ever sees ciphertext: a real HTTPS server stands in for Google's
// push service and captures exactly what WebPushLibSender puts on the wire.
describe('Web Push encryption (proof)', () => {
  const title = 'Candle lighting in 1h 30m';
  const body = 'Tel Aviv, 18:12. Shabbat Shalom!';
  const payload = JSON.stringify({
    notificationId: 'n-1',
    title,
    body,
    url: '/',
  });

  let server: Server;
  let base: string;
  let status = 201;
  let captured: Captured[] = [];
  let certDir: string;
  let originalCa: unknown;

  // The phone's side: its key pair and auth secret. Only it can decrypt.
  const phone = createECDH('prime256v1');
  phone.generateKeys();
  const phoneKeys = {
    p256dh: phone.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
  const sender = new WebPushLibSender({
    ...webpush.generateVAPIDKeys(),
    subject: 'mailto:push@personal-copilot.invalid',
  });

  beforeAll(async () => {
    certDir = mkdtempSync(join(tmpdir(), 'push-proof-'));
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:P-256',
        '-nodes',
        '-keyout',
        join(certDir, 'key.pem'),
        '-out',
        join(certDir, 'cert.pem'),
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
      ],
      { stdio: 'ignore' },
    );
    const cert = readFileSync(join(certDir, 'cert.pem'));
    // Trust the throwaway cert for this process only; web-push uses the global agent.
    originalCa = https.globalAgent.options.ca;
    https.globalAgent.options.ca = cert;

    server = createServer(
      { key: readFileSync(join(certDir, 'key.pem')), cert },
      (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          captured.push({
            method: req.method!,
            url: req.url!,
            headers: req.headers,
            body: Buffer.concat(chunks),
          });
          res.writeHead(status).end();
        });
      },
    );
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    https.globalAgent.options.ca = originalCa as never;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(certDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    captured = [];
    status = 201;
  });

  const send = () =>
    sender.send({ endpoint: `${base}/push/abc`, ...phoneKeys }, payload, 3600);

  it('sends aes128gcm ciphertext with no trace of the reminder text', async () => {
    expect(await send()).toBe('sent');
    expect(captured).toHaveLength(1);
    const [req] = captured;

    expect(req.method).toBe('POST');
    expect(req.headers['content-encoding']).toBe('aes128gcm');
    expect(req.headers['content-type']).toBe('application/octet-stream');
    expect(req.headers['authorization']).toMatch(/^vapid t=.+, k=.+$/);
    expect(req.headers['ttl']).toBe('3600');

    // Nothing readable anywhere: not in the body (raw, base64 or base64url), not in any header.
    const headerText = JSON.stringify(req.headers);
    for (const secret of [
      title,
      body,
      'Tel Aviv',
      'Candle',
      'notificationId',
    ]) {
      for (const haystack of [
        req.body.toString('latin1'),
        req.body.toString('utf8'),
        req.body.toString('base64'),
        req.body.toString('base64url'),
        headerText,
      ]) {
        expect(haystack).not.toContain(secret);
        expect(haystack).not.toContain(
          Buffer.from(secret).toString('base64url'),
        );
      }
    }
  });

  it.each([
    [0, '0'],
    [42, '42'],
  ])(
    'puts the TTL it was given (%i) on the wire, 0 included',
    async (ttl, header) => {
      expect(
        await sender.send(
          { endpoint: `${base}/push/abc`, ...phoneKeys },
          payload,
          ttl,
        ),
      ).toBe('sent');
      expect(captured[0].headers['ttl']).toBe(header);
    },
  );

  it("decrypts back to the payload with the phone's private key — and only with it", async () => {
    await send();
    const [req] = captured;

    const decrypted = ece.decrypt(req.body, {
      version: 'aes128gcm',
      privateKey: phone,
      authSecret: phoneKeys.auth,
    });
    expect(JSON.parse(decrypted.toString('utf8'))).toEqual({
      notificationId: 'n-1',
      title,
      body,
      url: '/',
    });

    const stranger = createECDH('prime256v1');
    stranger.generateKeys();
    expect(() =>
      ece.decrypt(req.body, {
        version: 'aes128gcm',
        privateKey: stranger,
        authSecret: phoneKeys.auth,
      }),
    ).toThrow();
  });

  it.each([
    [404, 'gone'],
    [410, 'gone'],
    [500, 'retry'],
    [503, 'retry'],
    [429, 'retry'],
    [400, 'failed'],
    [413, 'failed'],
  ] as const)(
    'maps a %i from the push service to %s',
    async (code, outcome) => {
      status = code;
      expect(await send()).toBe(outcome);
    },
  );

  it("reports 'retry', not an exception, when the push service is unreachable", async () => {
    expect(
      await sender.send(
        { endpoint: 'https://127.0.0.1:1/push/abc', ...phoneKeys },
        payload,
        3600,
      ),
    ).toBe('retry');
  });
});
