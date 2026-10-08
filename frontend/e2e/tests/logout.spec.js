const { test, expect } = require('@playwright/test');

// Log Out revokes the refresh token on the server (POST /auth/logout), best effort: a failed revoke
// still signs this device out. Gateway mocked.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

const REFRESH_TOKEN = 'e2e-persisted-refresh-token';

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
// Seeded once per tab, so a reload after logging out stays signed out.
async function signIn(page) {
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(fakeAccessToken()),
    refreshToken: JSON.stringify(REFRESH_TOKEN),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('e2e-signed-in')) {
      sessionStorage.setItem('e2e-signed-in', '1');
      localStorage.setItem('persist:auth', value);
    }
  }, persisted);
}

// Every other Gateway call answers 503 (a 401 from the real Gateway would sign the fake session
// out). /auth/logout answers `logoutStatus`; returns the recorded logout requests.
async function mockGateway(page, { logoutStatus }) {
  const logouts = [];
  const appOrigin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:8081').origin;
  await page.route(
    (url) => url.origin !== appOrigin,
    (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : route.fulfill({ status: 503, json: { message: 'unavailable' }, headers: CORS }),
  );
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/auth/logout', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    logouts.push({
      method: req.method(),
      contentType: req.headers()['content-type'],
      body: req.postDataJSON(),
    });
    return logoutStatus === 204
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: logoutStatus, json: { message: 'unavailable' }, headers: CORS });
  });
  return logouts;
}

const isLogoutCall = (r) =>
  r.url().endsWith('/auth/logout') && r.request().method() === 'POST';

const persistedAuth = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('persist:auth') ?? '{}'));

// LogoutCard: "Log Out" opens the in-card confirm, whose own "Log Out" logs out.
async function logOutViaAccount(page) {
  await page.goto('/account');
  await page.getByText('Log Out', { exact: true }).click();
  await expect(page.getByText('Log out of your account?')).toBeVisible();
  const logoutCall = page.waitForResponse(isLogoutCall);
  await page.getByText('Log Out', { exact: true }).first().click();
  return logoutCall;
}

async function expectSignedOut(page) {
  await expect(page.getByText('You need to log in to view your account.')).toBeVisible();
  const auth = await persistedAuth(page);
  expect(auth.accessToken).toBe('null');
  expect(auth.refreshToken).toBe('null');
  await page.reload();
  await expect(page.getByText('You need to log in to view your account.')).toBeVisible();
}

test('Log Out revokes the persisted refresh token, then signs out', async ({ page }) => {
  await signIn(page);
  const logouts = await mockGateway(page, { logoutStatus: 204 });

  const response = await logOutViaAccount(page);
  expect(response.status()).toBe(204);

  await expectSignedOut(page);
  expect(logouts).toEqual([
    { method: 'POST', contentType: 'application/json', body: { refresh_token: REFRESH_TOKEN } },
  ]);
});

test('a failed revoke (503) still signs this device out', async ({ page }) => {
  await signIn(page);
  const logouts = await mockGateway(page, { logoutStatus: 503 });

  const response = await logOutViaAccount(page);
  expect(response.status()).toBe(503);

  await expectSignedOut(page);
  expect(logouts).toHaveLength(1);
  expect(logouts[0].body).toEqual({ refresh_token: REFRESH_TOKEN });
  await expect(page.getByText(/unavailable/)).toHaveCount(0);
});
