const { test, expect } = require('@playwright/test');

// A session the server rejects: a 401 on a signed-in call signs out and the login
// screen says why — instead of the app staying "signed in" with every call failing. Gateway mocked.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

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

async function signIn(page) {
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(fakeAccessToken()),
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

const NOTICE = 'Your session ended — please log in again.';

test('a 401 on a signed-in call signs out and the login screen says why', async ({ page }) => {
  await signIn(page);
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/reminders', (route) => route.fulfill({ json: [], headers: CORS }));
  await page.route('**/users/me', (route) =>
    route.fulfill({
      status: 401,
      json: { message: 'Missing or invalid access token' },
      headers: CORS,
    }),
  );
  await page.goto('/account');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(NOTICE)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('persist:auth'))).toContain(
    '"accessToken":"null"',
  );

  // Leaving the login screen drops the notice; it isn't shown again.
  await page.getByText('Continue without logging in').click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/login');
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});

test('other errors keep the session', async ({ page }) => {
  await signIn(page);
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/reminders', (route) => route.fulfill({ json: [], headers: CORS }));
  await page.route('**/users/me', (route) =>
    route.fulfill({ status: 500, json: { message: 'Something went wrong' }, headers: CORS }),
  );
  await page.goto('/account');

  await expect(page.getByText(/Couldn't load/)).toBeVisible();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Log out', { exact: true })).toBeVisible();
});
