import { isAllowedPushEndpoint } from './push-endpoint-policy';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-db5p.notify.windows.com/w/?token=abc',
  ])('allows %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ['plain http', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['an explicit port', 'https://fcm.googleapis.com:8443/fcm/send/abc'],
    ['an unknown host', 'https://evil.example.com/fcm/send/abc'],
    ['a look-alike suffix', 'https://evilfcm.googleapis.com.example.com/x'],
    [
      'a host ending in the name without a dot',
      'https://notfcm.googleapis.com/x',
    ],
    ['an internal service', 'https://auth:8001/x'],
    ['not a URL', 'nope'],
  ])('refuses %s', (_name, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe('isAllowedPushEndpoint — bypass attempts', () => {
  it.each([
    ['userinfo before an unknown host', 'https://x@evil.com/x'],
    ['a push host as userinfo', 'https://fcm.googleapis.com@evil.com/x'],
    ['userinfo with a password', 'https://fcm.googleapis.com:443@evil.com/x'],
    [
      'an encoded slash in userinfo',
      'https://fcm.googleapis.com%2F@evil.com/x',
    ],
    [
      'a backslash before a push host',
      'https://evil.com\\@fcm.googleapis.com/x',
    ],
    ['a trailing-dot host', 'https://fcm.googleapis.com./x'],
    ['a push host as a path', 'https://evil.com/fcm.googleapis.com'],
    ['a push host in the query', 'https://evil.com/?h=.fcm.googleapis.com'],
    ['a push host in the fragment', 'https://evil.com#.fcm.googleapis.com'],
    ['an IPv4 literal', 'https://142.250.185.10/fcm/send/abc'],
    ['a hex IPv4 literal', 'https://0x7f000001/x'],
    ['an IPv6 literal', 'https://[::1]/x'],
    ['wss', 'wss://fcm.googleapis.com/x'],
    ['an empty string', ''],
  ])('refuses %s', (_name, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it.each([
    [
      'an uppercase host (URL lowercases it)',
      'https://FCM.GoogleAPIs.com/fcm/send/abc',
    ],
    [
      'the default port spelled out',
      'https://fcm.googleapis.com:443/fcm/send/abc',
    ],
  ])('allows %s', (_name, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  // WHATWG URL keeps these characters in the hostname (suffix check alone would pass), but web-push
  // dials the host legacy url.parse sees ("evil.example") — see test/push-endpoint-host.spec.ts.
  it.each([
    'https://evil.example;.fcm.googleapis.com/x',
    'https://evil.example%2e.fcm.googleapis.com/x',
    'https://evil.example{.fcm.googleapis.com/x',
    'https://169.254.169.254;.fcm.googleapis.com/x',
    'https://evil.example".fcm.googleapis.com/x',
  ])('refuses %s (host url.parse disagrees on)', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe('isAllowedPushEndpoint — hosts only the plain-host rule refuses', () => {
  // WHATWG and url.parse agree on these hosts, so the legacy-parse check alone would let them through.
  it.each(['!', '$', '&', '(', ')', '*', '+', ',', '=', '_', '~'])(
    'refuses a host containing %j',
    (c) => {
      expect(isAllowedPushEndpoint(`https://a${c}b.fcm.googleapis.com/x`)).toBe(
        false,
      );
    },
  );
});

describe('isAllowedPushEndpoint — malformed percent-encoding in userinfo', () => {
  // Legacy url.parse throws URIError on a lone '%' in userinfo (WHATWG accepts it); must return false.
  it.each([
    'https://a%@fcm.googleapis.com/x',
    'https://%@fcm.googleapis.com/x',
    'https://x%zz@fcm.googleapis.com/x',
  ])('returns false (never throws) for %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});
