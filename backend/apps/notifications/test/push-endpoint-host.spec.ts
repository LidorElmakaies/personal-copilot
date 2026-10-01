import { createECDH, randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import https from 'https';
import { parse as legacyParse } from 'url';
import webpush from 'web-push';
import { isAllowedPushEndpoint } from '../src/models/push-endpoint-policy';
import { WebPushLibSender } from '../src/infrastructure/webpush/web-push-lib.sender';
import { WebPushChannel } from '../src/infrastructure/webpush/web-push.channel';
import { InMemoryDeliveryProgress } from './in-memory-delivery-progress';
import { InMemoryPushSubscriptionRepository } from './in-memory-push-subscription.repository';

// The allowlist checks the endpoint with WHATWG `new URL`, but web-push opens the connection to
// whatever legacy `url.parse` says the host is. This pins down the host that actually gets dialled,
// with https.request faked (answers 201, no network).
describe('push endpoint host actually dialled (allowlist vs web-push)', () => {
  const phone = createECDH('prime256v1');
  phone.generateKeys();
  const keys = {
    p256dh: phone.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
  const content = { notificationId: 'n-1', title: 'T', body: 'B' };

  let dialled: string[];
  let ports: unknown[];
  let repo: InMemoryPushSubscriptionRepository;
  let channel: WebPushChannel;

  beforeEach(() => {
    dialled = [];
    ports = [];
    jest.spyOn(https, 'request').mockImplementation(((
      options: https.RequestOptions,
      onResponse: (res: EventEmitter & { statusCode: number }) => void,
    ) => {
      dialled.push(String(options.hostname));
      ports.push(options.port);
      const req = Object.assign(new EventEmitter(), {
        write: () => true,
        end: () => {
          const res = Object.assign(new EventEmitter(), {
            statusCode: 201,
            headers: {},
          });
          onResponse(res);
          setImmediate(() => res.emit('end'));
        },
        destroy: () => undefined,
      });
      return req;
    }) as never);

    repo = new InMemoryPushSubscriptionRepository();
    channel = new WebPushChannel(
      repo,
      new WebPushLibSender({
        ...webpush.generateVAPIDKeys(),
        subject: 'mailto:push@personal-copilot.invalid',
      }),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  /** Delivers to one freshly stored subscription; returns how many rows are left. */
  const deliverTo = async (endpoint: string) => {
    await repo.upsertByEndpoint({ userId: 'u1', endpoint, ...keys });
    await channel.deliver(
      'u1',
      content,
      new Date(Date.now() + 3600_000),
      new InMemoryDeliveryProgress(),
    );
    return { rowsLeft: repo.rows.size };
  };

  it('dials the endpoint host for a normal FCM subscription', async () => {
    expect(await deliverTo('https://fcm.googleapis.com/fcm/send/abc')).toEqual({
      rowsLeft: 1,
    });
    expect(dialled).toEqual(['fcm.googleapis.com']);
  });

  // WHATWG's hostname ends in ".fcm.googleapis.com" but web-push's url.parse dials "evil.example".
  it.each([
    'https://evil.example;.fcm.googleapis.com/x',
    'https://evil.example%2e.fcm.googleapis.com/x',
    'https://evil.example{.fcm.googleapis.com/x',
    "https://evil.example'.fcm.googleapis.com/x",
    'https://evil.example`.fcm.googleapis.com/x',
  ])('never dials a host outside the allowlist for %s', async (endpoint) => {
    expect(await deliverTo(endpoint)).toEqual({ rowsLeft: 0 }); // refused → removed
    expect(dialled).toEqual([]);
  });

  // Accepted spellings: whatever they look like, the connection goes to the push host on 443.
  it.each([
    [
      'uppercase',
      'https://FCM.GoogleAPIs.com/fcm/send/abc',
      'fcm.googleapis.com',
    ],
    [
      'fullwidth letters (IDNA-mapped)',
      'https://ｆｃｍ.googleapis.com/x',
      'fcm.googleapis.com',
    ],
    [
      'an ideographic full stop',
      'https://fcm。googleapis.com/x',
      'fcm.googleapis.com',
    ],
    [
      'a tab inside the host (WHATWG strips it)',
      'https://fcm.google\tapis.com/x',
      'fcm.googleapis.com',
    ],
    [
      'a benign userinfo',
      'https://evil.example@fcm.googleapis.com/x',
      'fcm.googleapis.com',
    ],
    [
      'a zero-padded default port',
      'https://fcm.googleapis.com:0443/x',
      'fcm.googleapis.com',
    ],
  ])('%s dials only the push host', async (_name, endpoint, host) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
    await deliverTo(endpoint);
    expect(dialled).toEqual([host]);
    expect(ports.every((p) => p == null || Number(p) === 443)).toBe(true);
  });
});

// Brute force: one or two odd characters at every position of a few endpoints. Anything the policy
// accepts must have a url.parse host (what web-push dials, web-push-lib.js) on the allowlist and no
// non-443 port.
describe('allowlist vs url.parse — generated corpus', () => {
  const allowed = [
    'fcm.googleapis.com',
    'push.services.mozilla.com',
    'push.apple.com',
    'notify.windows.com',
  ];
  const onAllowlist = (h: string | null) =>
    !!h && allowed.some((a) => h === a || h.endsWith(`.${a}`));

  const odd = [
    ...Array.from({ length: 0x80 }, (_, i) => String.fromCharCode(i)),
    '%2e',
    '%2E',
    '%40',
    '%2f',
    '%5c',
    '%3a',
    '%00',
    '%09',
    '%25',
    '。',
    '．',
    '｡',
    '​',
    '­',
    '﻿',
    '＠',
    '／',
    '∕',
    'İ',
    'ſ',
    'K',
    '\r\n',
    '..',
    '//',
  ];
  const templates = [
    'https://fcm.googleapis.com/x',
    'https://evil.example.fcm.googleapis.com/x',
    'https://evil.example@fcm.googleapis.com/x',
    'https://a.push.apple.com:443/x',
  ];
  const corpus = function* () {
    for (const t of templates) {
      for (let i = 0; i <= t.length; i++) {
        for (const c of odd) {
          yield t.slice(0, i) + c + t.slice(i);
          yield t.slice(0, i) + c + t.slice(i + 1);
          for (const d of ['@', '/', '\\', ':', '#', '?', ';', '.']) {
            yield t.slice(0, i) + c + d + t.slice(i);
          }
        }
      }
    }
  };

  it('never accepts an endpoint web-push would dial off the allowlist', () => {
    const escapes: string[] = [];
    for (const endpoint of corpus()) {
      let ok: boolean;
      try {
        ok = isAllowedPushEndpoint(endpoint);
      } catch {
        continue; // a throw is a refusal here; the throwing itself is pinned in push-endpoint-policy.spec.ts
      }
      if (!ok) continue;
      const parsed = legacyParse(endpoint);
      if (
        parsed.protocol !== 'https:' ||
        !onAllowlist(parsed.hostname) ||
        (parsed.port !== null && Number(parsed.port) !== 443)
      ) {
        escapes.push(endpoint);
      }
    }
    expect(escapes).toEqual([]);
  });
});
