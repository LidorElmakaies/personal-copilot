const { test, expect } = require('@playwright/test');

// Staying signed in: the 15-min access token is renewed with the refresh token (POST /auth/refresh)
// before it expires, at start when it already has, and once on a 401 before retrying the call.
// Only a refresh the server refuses signs out — to login, with a notice saying why. Gateway mocked;
// the clock starts at T0 and runs (install + resume), so tests can jump past an expiry.

const T0 = new Date('2026-09-27T08:00:00Z');
const NOTICE = 'Your session ended — please log in again.';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const SHABBAT = {
  candleLighting: '2026-10-02T15:04:00.000Z',
  havdalah: '2026-10-03T16:00:00.000Z',
  parasha: null,
  holidays: [{ en: 'Shmini Atzeret', he: 'שמיני עצרת' }],
  isNow: false,
};
const PROFILE = { firstName: 'Dana', lastName: null, phone: null, location: null };

// Unsigned but well-formed — the app only decodes claims, never verifies. Expires `expiresIn`
// seconds after T0; `n` tells tokens apart.
function fakeAccessToken(expiresIn, n = 1) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'e2e@example.com',
    role: 'user',
    exp: Math.floor(T0.getTime() / 1000) + expiresIn,
    n,
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

const OLD = fakeAccessToken(120); // 2 minutes left at T0
const EXPIRED = fakeAccessToken(-60, 2);
const RENEWED = fakeAccessToken(120 + 900, 3);

// redux-persist on web: AsyncStorage → localStorage, each field JSON-stringified on its own. Only
// on the first load, so a test can reload and see what the app saved.
async function signIn(page, accessToken) {
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(accessToken),
    refreshToken: JSON.stringify('fake-refresh'),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('e2e-signed-in')) {
      sessionStorage.setItem('e2e-signed-in', '1');
      localStorage.setItem('persist:auth', value);
    }
  }, persisted);
}

const persistedAuth = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('persist:auth') ?? '{}'));

// Answers the CORS preflight; otherwise `handler(route, request)`.
function api(page, pattern, handler) {
  return page.route(pattern, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    return handler(route, req);
  });
}

const json = (route, status, body) => route.fulfill({ status, json: body, headers: CORS });
const unauthorized = (route) => json(route, 401, { message: 'Missing or invalid access token' });
const bearer = (req) => req.headers().authorization?.replace('Bearer ', '');

// Mocks Gateway. `refresh(route)` answers POST /auth/refresh (default: a new pair); GET /users/me
// answers 401 to any token but RENEWED unless `profile` says otherwise. Returns what was called.
async function mockGateway(page, { refresh, profile } = {}) {
  const calls = { refreshes: [], profileTokens: [] };
  await page.clock.install({ time: T0 });
  await page.clock.resume();
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await api(page, '**/reminders', (route) => json(route, 200, []));
  await api(page, '**/auth/refresh', (route, req) => {
    calls.refreshes.push(req.postDataJSON().refresh_token);
    if (refresh) return refresh(route);
    return json(route, 200, { access_token: RENEWED, refresh_token: 'fake-refresh-2' });
  });
  await api(page, '**/users/me', (route, req) => {
    calls.profileTokens.push(bearer(req));
    if (profile) return profile(route, req);
    return bearer(req) === RENEWED ? json(route, 200, PROFILE) : unauthorized(route);
  });
  return calls;
}

const signedInOnAccount = async (page) => {
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Log out', { exact: true })).toBeVisible();
  await expect(page.getByText(NOTICE)).toHaveCount(0);
};

test('renews the access token a minute before it expires', async ({ page }) => {
  const calls = await mockGateway(page, {
    profile: (route) => json(route, 200, PROFILE),
  });
  await signIn(page, OLD);
  await page.goto('/account');
  await signedInOnAccount(page);
  expect(calls.refreshes).toEqual([]);

  await page.clock.fastForward(61_000);

  await expect.poll(() => calls.refreshes).toEqual(['fake-refresh']);
  await expect
    .poll(async () => (await persistedAuth(page)).refreshToken)
    .toBe('"fake-refresh-2"');
  expect((await persistedAuth(page)).accessToken).toBe(JSON.stringify(RENEWED));
  await signedInOnAccount(page);
});

test('an expired access token at start renews instead of signing out', async ({ page }) => {
  const calls = await mockGateway(page);
  await signIn(page, EXPIRED);
  await page.goto('/account');

  await signedInOnAccount(page);
  await expect(page.getByText('Dana', { exact: true })).toBeVisible();
  expect(calls.refreshes).toEqual(['fake-refresh']);
  expect(calls.profileTokens).toEqual([RENEWED]); // renewed before sending, never sent expired
});

test('a 401 renews the session once and retries the call', async ({ page }) => {
  const calls = await mockGateway(page);
  await signIn(page, OLD);
  await page.goto('/account');

  await signedInOnAccount(page);
  await expect(page.getByText('Dana', { exact: true })).toBeVisible();
  expect(calls.refreshes).toEqual(['fake-refresh']);
  expect(calls.profileTokens).toEqual([OLD, RENEWED]);
});

test('a call still refused after renewing is not retried again', async ({ page }) => {
  const calls = await mockGateway(page, { profile: unauthorized });
  await signIn(page, OLD);
  await page.goto('/account');

  await expect(page.getByText(/Couldn't load/)).toBeVisible();
  await signedInOnAccount(page);
  expect(calls.refreshes).toEqual(['fake-refresh']);
  expect(calls.profileTokens).toEqual([OLD, RENEWED]);
});

test.describe('two calls failing together', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

  test('cause one refresh', async ({ page }) => {
    const calls = await mockGateway(page);
    await page.route('**/calendar/shabbat?*', (route) => json(route, 200, SHABBAT));
    // Home: the reminder bell loads GET /reminders and the GPS fix's location sync GET /users/me.
    // Both 401s are held until both calls have arrived, so they fail at the same moment.
    const held = [];
    const release = () => held.length === 2 && held.forEach((route) => unauthorized(route));
    const holdOld = (onRenewed) => (route, req) => {
      if (bearer(req) === RENEWED) return onRenewed(route);
      held.push(route);
      release();
    };
    const reminderTokens = [];
    await api(page, '**/reminders', (route, req) => {
      reminderTokens.push(bearer(req));
      return holdOld((r) => json(r, 200, []))(route, req);
    });
    await api(page, '**/users/me', (route, req) => {
      calls.profileTokens.push(bearer(req));
      return holdOld((r) => json(r, 200, PROFILE))(route, req);
    });
    await api(page, '**/users/me/location', (route) => json(route, 200, PROFILE));
    await signIn(page, OLD);
    await page.goto('/');

    // Both retried with the one renewal's token.
    await expect.poll(() => calls.profileTokens).toEqual([OLD, RENEWED]);
    await expect.poll(() => reminderTokens).toEqual([OLD, RENEWED]);
    await page.waitForTimeout(500); // anything else that was going to call /auth/refresh has
    expect(held).toHaveLength(2);
    expect(calls.refreshes).toEqual(['fake-refresh']);
  });
});

test('a refresh the server refuses signs out to login with a notice', async ({ page }) => {
  const calls = await mockGateway(page, {
    refresh: (route) => json(route, 401, { message: 'Invalid or expired refresh token' }),
  });
  await signIn(page, OLD);
  await page.goto('/account');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(NOTICE)).toBeVisible();
  expect(calls.refreshes).toEqual(['fake-refresh']);
  expect((await persistedAuth(page)).accessToken).toBe('null');

  // Leaving the login screen drops the notice; it isn't shown again.
  await page.getByText('Continue without logging in').click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/login');
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});

test('offline keeps the session and renews once Gateway answers again', async ({ page }) => {
  let online = false;
  const calls = await mockGateway(page, {
    refresh: (route) =>
      online
        ? json(route, 200, { access_token: RENEWED, refresh_token: 'fake-refresh-2' })
        : route.abort('internetdisconnected'),
  });
  await signIn(page, EXPIRED);
  await page.goto('/account');

  await signedInOnAccount(page);
  await expect(page.getByText(/Couldn't load/)).toBeVisible();
  expect(calls.refreshes).toEqual(['fake-refresh']); // the 401 shares that attempt, no second one
  expect((await persistedAuth(page)).accessToken).toBe(JSON.stringify(EXPIRED));

  online = true;
  await page.clock.fastForward(31_000);

  await expect.poll(() => calls.refreshes).toEqual(['fake-refresh', 'fake-refresh']);
  await expect
    .poll(async () => (await persistedAuth(page)).accessToken)
    .toBe(JSON.stringify(RENEWED));
  await signedInOnAccount(page);
});

test('a 5xx from /auth/refresh keeps the session', async ({ page }) => {
  await mockGateway(page, {
    refresh: (route) => json(route, 502, { message: 'users_unreachable' }),
  });
  await signIn(page, EXPIRED);
  await page.goto('/account');

  await signedInOnAccount(page);
  await expect(page.getByText(/Couldn't load/)).toBeVisible();
});

test('other errors keep the session', async ({ page }) => {
  await mockGateway(page, {
    profile: (route) => json(route, 500, { message: 'Something went wrong' }),
  });
  await signIn(page, OLD);
  await page.goto('/account');

  await expect(page.getByText(/Couldn't load/)).toBeVisible();
  await signedInOnAccount(page);
});
