const { test, expect } = require('@playwright/test');

// Allowing notifications again in the browser's site settings while the app is open: the browser dropped the subscription when the site was blocked; once allowed
// again the app subscribes on its own (they weren't turned off in the app), no reload.
// Real Chromium permissions (full Chromium — the headless shell reports notifications as denied);
// only PushManager is stubbed, since headless Chromium has no push service. Gateway mocked.
test.use({ channel: 'chromium' });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

const SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device',
  expirationTime: null,
  keys: { p256dh: 'e2e-p256dh', auth: 'e2e-auth' },
};

function fakeAccessToken() {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'e2e@example.com',
    role: 'user',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

test('allowed again while open: subscribes again and the switch turns on', async ({ page, context }) => {
  const token = fakeAccessToken();
  // Signed in; the prompt was answered before, so it doesn't cover the Account tab.
  await page.addInitScript(
    ({ auth, notifications }) => {
      localStorage.setItem('persist:auth', auth);
      localStorage.setItem('persist:notifications', notifications);
    },
    {
      auth: JSON.stringify({
        accessToken: JSON.stringify(token),
        refreshToken: JSON.stringify('fake-refresh'),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
      notifications: JSON.stringify({
        promptDismissed: 'true',
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    },
  );
  // No subscription until the app makes one.
  await page.addInitScript((subscription) => {
    let current = null;
    const wrap = (json) => ({ endpoint: json.endpoint, toJSON: () => json, unsubscribe: async () => true });
    PushManager.prototype.getSubscription = async () => (current ? wrap(current) : null);
    PushManager.prototype.subscribe = async () => {
      current = subscription;
      return wrap(subscription);
    };
  }, SUBSCRIPTION);

  const posts = [];
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/users/me', (route) =>
    route.fulfill({ json: { firstName: null, lastName: null, phone: null, location: null }, headers: CORS }),
  );
  await page.route('**/notifications/vapid-public-key', (route) =>
    route.fulfill({ json: { publicKey: Buffer.alloc(65, 4).toString('base64url') }, headers: CORS }),
  );
  await page.route('**/notifications/subscriptions', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    posts.push({ body: req.postDataJSON(), auth: req.headers().authorization });
    return route.fulfill({ status: 204, headers: CORS });
  });

  await page.goto('/account');
  await expect(page.getByText('Turn on to get reminders here')).toBeVisible();
  expect(posts).toEqual([]);

  const post = page.waitForResponse(
    (r) => r.url().endsWith('/notifications/subscriptions') && r.request().method() === 'POST',
  );
  await context.grantPermissions(['notifications']);
  await post;

  await expect(page.getByText('Reminders reach this browser')).toBeVisible();
  expect(posts).toEqual([{ body: SUBSCRIPTION, auth: `Bearer ${token}` }]);
});
