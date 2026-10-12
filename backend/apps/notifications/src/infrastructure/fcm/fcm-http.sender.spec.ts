import { Logger } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { FcmHttpSender } from './fcm-http.sender';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const config = {
  projectId: 'proj-1',
  clientEmail: 'sender@proj-1.iam.gserviceaccount.com',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const fcmError = (
  status: number,
  statusText: string,
  errorCode?: string,
  message = 'x',
) =>
  json(status, {
    error: {
      code: status,
      status: statusText,
      message,
      details: errorCode
        ? [
            {
              '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
              errorCode,
            },
          ]
        : [],
    },
  });

describe('FcmHttpSender', () => {
  let fetchMock: jest.SpyInstance;
  let sendResponses: (() => Response | Promise<Response>)[];
  let sender: FcmHttpSender;

  type Call = [string, RequestInit & { body: string }];
  const calls = (url: string): Call[] =>
    (fetchMock.mock.calls as Call[]).filter(([u]) => u.startsWith(url));
  const sends = () => calls('https://fcm.googleapis.com/');
  const tokenCalls = () => calls('https://oauth2.googleapis.com/token');

  beforeEach(() => {
    sendResponses = [];
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation((url) => {
      if ((url as string).startsWith('https://oauth2.googleapis.com/token')) {
        return Promise.resolve(
          json(200, { access_token: 'ya29.access', expires_in: 3599 }),
        );
      }
      const next =
        sendResponses.shift() ??
        (() => json(200, { name: 'projects/proj-1/messages/1' }));
      return Promise.resolve(next());
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    sender = new FcmHttpSender(config);
  });

  afterEach(() => jest.restoreAllMocks());

  it('gets an access token with a JWT signed by the service-account key, then sends a high-priority data message', async () => {
    expect(await sender.send('device-token', { v: '1', enc: 'abc' }, 120)).toBe(
      'sent',
    );

    const [, tokenInit] = tokenCalls()[0];
    const assertion = new URLSearchParams(tokenInit.body).get('assertion')!;
    expect(
      jwt.verify(assertion, publicKey.export({ type: 'spki', format: 'pem' }), {
        algorithms: ['RS256'],
      }),
    ).toMatchObject({
      iss: config.clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    });

    const [url, init] = sends()[0];
    expect(url).toBe(
      'https://fcm.googleapis.com/v1/projects/proj-1/messages:send',
    );
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer ya29.access',
    );
    expect(JSON.parse(init.body)).toEqual({
      message: {
        token: 'device-token',
        data: { v: '1', enc: 'abc' },
        android: { priority: 'HIGH', ttl: '120s' },
      },
    });
  });

  it('reuses the access token until shortly before it expires', async () => {
    await sender.send('t', {}, 60);
    await sender.send('t', {}, 60);
    expect(tokenCalls()).toHaveLength(1);
    expect(sends()).toHaveLength(2);
  });

  it.each([
    [
      'unregistered (404 UNREGISTERED)',
      () => fcmError(404, 'NOT_FOUND', 'UNREGISTERED'),
      'gone',
    ],
    [
      'a token FCM cannot parse (400)',
      () =>
        fcmError(
          400,
          'INVALID_ARGUMENT',
          'INVALID_ARGUMENT',
          'The registration token is not a valid FCM registration token',
        ),
      'gone',
    ],
    [
      "another project's token (403 SENDER_ID_MISMATCH)",
      () => fcmError(403, 'PERMISSION_DENIED', 'SENDER_ID_MISMATCH'),
      'gone',
    ],
    [
      'quota (429)',
      () => fcmError(429, 'RESOURCE_EXHAUSTED', 'QUOTA_EXCEEDED'),
      'retry',
    ],
    [
      'FCM down (503)',
      () => fcmError(503, 'UNAVAILABLE', 'UNAVAILABLE'),
      'retry',
    ],
    ['internal (500)', () => fcmError(500, 'INTERNAL', 'INTERNAL'), 'retry'],
    [
      'a bad payload (400, not about the token)',
      () =>
        fcmError(
          400,
          'INVALID_ARGUMENT',
          'INVALID_ARGUMENT',
          'Invalid value at message.data',
        ),
      'failed',
    ],
    [
      'forbidden (403)',
      () => fcmError(403, 'PERMISSION_DENIED', 'THIRD_PARTY_AUTH_ERROR'),
      'failed',
    ],
  ])('%s → %s', async (_name, response, outcome) => {
    sendResponses.push(response);
    expect(await sender.send('t', {}, 60)).toBe(outcome);
  });

  it('no response → retry', async () => {
    sendResponses.push(() =>
      Promise.reject(
        Object.assign(new Error('fetch failed'), { code: 'ECONNRESET' }),
      ),
    );
    expect(await sender.send('t', {}, 60)).toBe('retry');
  });

  it('401 → retry with a fresh access token', async () => {
    sendResponses.push(() => fcmError(401, 'UNAUTHENTICATED'));
    expect(await sender.send('t', {}, 60)).toBe('retry');
    expect(await sender.send('t', {}, 60)).toBe('sent');
    expect(tokenCalls()).toHaveLength(2);
  });

  it('a key Google refuses → failed, nothing sent; Google down → retry', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json(400, { error: 'invalid_grant' })),
    );
    expect(await sender.send('t', {}, 60)).toBe('failed');
    fetchMock.mockImplementation(() => Promise.resolve(json(503, {})));
    expect(await sender.send('t', {}, 60)).toBe('retry');
    expect(sends()).toHaveLength(0);
  });

  it('never logs the device token or the access token', async () => {
    const lines: string[] = [];
    for (const level of ['warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((m: unknown) => {
        lines.push(String(m));
      });
    }
    sendResponses.push(
      () => fcmError(503, 'UNAVAILABLE'),
      () => fcmError(400, 'INVALID_ARGUMENT', 'INVALID_ARGUMENT', 'bad'),
    );
    await sender.send('secret-device-token', {}, 60);
    await sender.send('secret-device-token', {}, 60);
    expect(lines).toHaveLength(2);
    for (const line of lines)
      expect(line).not.toMatch(/secret-device-token|ya29/);
  });

  it('without a config it sends nothing', async () => {
    expect(await new FcmHttpSender(null).send('t', {}, 60)).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
