const { test, expect } = require('@playwright/test');

// Turning on notifications (plan task 2.14): the after-login prompt, the Account card, log-out
// cleanup — Gateway mocked, the browser's PushManager/Notification stubbed (headless Chromium has no
// push service). The service worker itself is service-worker.spec.js.

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

const VAPID_PUBLIC_KEY = Buffer.alloc(65, 4).toString('base64url');

// Unsigned but well-formed and unexpired — the app only decodes claims, never verifies.
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

// redux-persist on web: AsyncStorage → localStorage, each field JSON-stringified on its own.
async function signIn(page) {
  const token = fakeAccessToken();
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(token),
    refreshToken: JSON.stringify('fake-refresh'),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('e2e-signed-in')) {
      sessionStorage.setItem('e2e-signed-in', '1');
      localStorage.setItem('persist:auth', value);
    }
  }, persisted);
  return token;
}

// Stubs the browser side: `permission` to start with, `answer` to give if asked, `existing` = a
// subscription this browser already has. Subscriptions live in localStorage, so they survive reloads.
async function stubBrowserPush(page, { permission = 'default', answer = 'granted', existing = null }) {
  await page.addInitScript(
    ({ permission, answer, existing, subscription }) => {
      const KEY = 'e2e-push-subscription';
      if (!sessionStorage.getItem('e2e-push-seeded')) {
        sessionStorage.setItem('e2e-push-seeded', '1');
        localStorage.setItem('e2e-permission', permission);
        if (existing) localStorage.setItem(KEY, JSON.stringify(existing));
      }
      Object.defineProperty(Notification, 'permission', {
        configurable: true,
        get: () => localStorage.getItem('e2e-permission'),
      });
      Notification.requestPermission = async () => {
        window.__permissionAsked = true;
        if (localStorage.getItem('e2e-permission') === 'default') {
          localStorage.setItem('e2e-permission', answer);
        }
        return localStorage.getItem('e2e-permission');
      };
      const wrap = (json) => ({
        endpoint: json.endpoint,
        toJSON: () => json,
        unsubscribe: async () => {
          localStorage.removeItem(KEY);
          return true;
        },
      });
      PushManager.prototype.getSubscription = async () => {
        const saved = localStorage.getItem(KEY);
        return saved ? wrap(JSON.parse(saved)) : null;
      };
      PushManager.prototype.subscribe = async (options) => {
        window.__applicationServerKeyBytes = options.applicationServerKey.byteLength;
        localStorage.setItem(KEY, JSON.stringify(subscription));
        return wrap(subscription);
      };
    },
    { permission, answer, existing, subscription: SUBSCRIPTION },
  );
}

// This browser's persisted "notifications were turned off here" (notificationsSlice.optedOut).
async function seedOptedOut(page) {
  const persisted = JSON.stringify({
    optedOut: 'true',
    promptDismissed: 'true',
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('e2e-opted-out-seeded')) {
      sessionStorage.setItem('e2e-opted-out-seeded', '1');
      localStorage.setItem('persist:notifications', value);
    }
  }, persisted);
}

const browserSubscription = (page) =>
  page.evaluate(() => localStorage.getItem('e2e-push-subscription'));

// Mocks Gateway; returns the recorded subscription POSTs/DELETEs.
async function mockGateway(page) {
  const calls = { posts: [], deletes: [] };
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/users/me', (route) =>
    route.fulfill({
      json: { firstName: null, lastName: null, phone: null, location: null },
      headers: CORS,
    }),
  );
  await page.route('**/notifications/vapid-public-key', (route) =>
    route.fulfill({ json: { publicKey: VAPID_PUBLIC_KEY }, headers: CORS }),
  );
  await page.route('**/notifications/subscriptions', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const call = { body: req.postDataJSON(), auth: req.headers().authorization };
    (req.method() === 'POST' ? calls.posts : calls.deletes).push(call);
    return route.fulfill({ status: 204, headers: CORS });
  });
  return calls;
}

const isSubscriptionCall = (method) => (r) =>
  r.url().endsWith('/notifications/subscriptions') && r.request().method() === method;

const settle = (page) => page.waitForTimeout(1000);

test.describe('signed in, never asked', () => {
  test('the prompt shows; Turn on asks the browser, subscribes and sends it', async ({ page }) => {
    const token = await signIn(page);
    await stubBrowserPush(page, { permission: 'default', answer: 'granted' });
    const calls = await mockGateway(page);
    await page.goto('/');

    await expect(page.getByText('Turn on notifications?')).toBeVisible();
    const post = page.waitForResponse(isSubscriptionCall('POST'));
    await page.getByText('Turn on', { exact: true }).click();
    await post;

    expect(await page.evaluate(() => window.__permissionAsked)).toBe(true);
    expect(await page.evaluate(() => window.__applicationServerKeyBytes)).toBe(65);
    expect(calls.posts).toEqual([{ body: SUBSCRIPTION, auth: `Bearer ${token}` }]);
    await expect(page.getByText('Turn on notifications?')).toBeHidden();

    await page.goto('/account');
    await expect(page.getByText('Reminders reach this browser')).toBeVisible();
  });

  test('Not now: no subscription, and the prompt stays away after a reload', async ({ page }) => {
    await signIn(page);
    await stubBrowserPush(page, { permission: 'default' });
    const calls = await mockGateway(page);
    await page.goto('/');

    await page.getByText('Not now', { exact: true }).click();
    await expect(page.getByText('Turn on notifications?')).toBeHidden();
    await page.reload();
    await settle(page);
    await expect(page.getByText('Turn on notifications?')).toBeHidden();
    expect(calls.posts).toEqual([]);
    expect(await page.evaluate(() => window.__permissionAsked)).toBeUndefined();
  });

  test('the browser blocks it: the Account card says so and the switch is off', async ({ page }) => {
    await signIn(page);
    await stubBrowserPush(page, { permission: 'default', answer: 'denied' });
    const calls = await mockGateway(page);
    await page.goto('/');
    await page.getByText('Turn on', { exact: true }).click();
    await expect(page.getByText('Turn on notifications?')).toBeHidden();

    await page.goto('/account');
    await expect(page.getByText('Blocked for this site')).toBeVisible();
    await expect(page.getByText(/Allow notifications for this site/)).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Notifications' })).toBeDisabled();
    expect(calls.posts).toEqual([]);
  });
});

test.describe('signed in, this browser already subscribed', () => {
  test('no prompt; the subscription is re-sent on start', async ({ page }) => {
    const token = await signIn(page);
    await stubBrowserPush(page, { permission: 'granted', existing: SUBSCRIPTION });
    const calls = await mockGateway(page);
    const post = page.waitForResponse(isSubscriptionCall('POST'));
    await page.goto('/');
    await post;
    await settle(page);

    await expect(page.getByText('Turn on notifications?')).toBeHidden();
    expect(calls.posts).toEqual([{ body: SUBSCRIPTION, auth: `Bearer ${token}` }]);
  });

  test('the Account switch turns it off: DELETE with the endpoint, browser unsubscribed', async ({ page }) => {
    const token = await signIn(page);
    await stubBrowserPush(page, { permission: 'granted', existing: SUBSCRIPTION });
    const calls = await mockGateway(page);
    await page.goto('/account');
    await expect(page.getByText('Reminders reach this browser')).toBeVisible();

    const del = page.waitForResponse(isSubscriptionCall('DELETE'));
    await page.getByRole('switch', { name: 'Notifications' }).click();
    await del;

    await expect(page.getByText('Turn on to get reminders here')).toBeVisible();
    expect(calls.deletes).toEqual([{ body: { endpoint: SUBSCRIPTION.endpoint }, auth: `Bearer ${token}` }]);
    expect(await browserSubscription(page)).toBeNull();
  });

  test('Log Out removes this browser’s subscription before signing out', async ({ page }) => {
    const token = await signIn(page);
    await stubBrowserPush(page, { permission: 'granted', existing: SUBSCRIPTION });
    const calls = await mockGateway(page);
    await page.goto('/account');

    await page.getByText('Log Out', { exact: true }).click();
    const del = page.waitForResponse(isSubscriptionCall('DELETE'));
    await page.getByText('Log Out', { exact: true }).first().click();
    await del;

    await expect(page.getByText('You need to log in to view your account.')).toBeVisible();
    expect(calls.deletes).toEqual([{ body: { endpoint: SUBSCRIPTION.endpoint }, auth: `Bearer ${token}` }]);
    expect(await browserSubscription(page)).toBeNull();
  });
});

test.describe('signed in, the browser allows notifications, no subscription (e.g. site blocked, then allowed again)', () => {
  test('subscribes on start and sends it; no prompt, the switch shows on', async ({ page }) => {
    const token = await signIn(page);
    await stubBrowserPush(page, { permission: 'granted', existing: null });
    const calls = await mockGateway(page);
    const post = page.waitForResponse(isSubscriptionCall('POST'));
    await page.goto('/account');
    await post;

    await expect(page.getByText('Reminders reach this browser')).toBeVisible();
    await expect(page.getByText('Turn on notifications?')).toBeHidden();
    expect(calls.posts[0]).toEqual({ body: SUBSCRIPTION, auth: `Bearer ${token}` });
    expect(await browserSubscription(page)).not.toBeNull();
  });

  test('turned off here before: stays off', async ({ page }) => {
    await signIn(page);
    await seedOptedOut(page);
    await stubBrowserPush(page, { permission: 'granted', existing: null });
    const calls = await mockGateway(page);
    await page.goto('/account');
    await settle(page);

    await expect(page.getByText('Turn on to get reminders here')).toBeVisible();
    expect(calls.posts).toEqual([]);
    expect(await browserSubscription(page)).toBeNull();
  });
});

test.describe('signed out', () => {
  test('no prompt, nothing sent', async ({ page }) => {
    await stubBrowserPush(page, { permission: 'granted', existing: SUBSCRIPTION });
    const calls = await mockGateway(page);
    await page.goto('/');
    await settle(page);

    await expect(page.getByText('Turn on notifications?')).toBeHidden();
    expect(calls.posts).toEqual([]);
  });
});
