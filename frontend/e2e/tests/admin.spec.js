const { test, expect } = require('@playwright/test');

// Admin tab: only admins see it, and it lists GET /admin/status. Gateway mocked,
// signed in with a fake token, same as session.spec.js.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

// Unsigned but well-formed and unexpired — the app only decodes claims, never verifies.
function fakeAccessToken(role) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'e2e@example.com',
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

async function signIn(page, role) {
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(fakeAccessToken(role)),
    refreshToken: JSON.stringify('fake-refresh'),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('e2e-signed-in')) {
      sessionStorage.setItem('e2e-signed-in', '1');
      localStorage.setItem('persist:auth', value);
    }
  }, persisted);
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/reminders', (route) => route.fulfill({ json: [], headers: CORS }));
}

const up = (service, version) => ({
  service,
  status: 'up',
  version,
  builtAt: '2026-10-05T18:00:00Z',
  startedAt: new Date(Date.now() - 90 * 60000).toISOString(),
  latencyMs: service === 'gateway' ? null : 8,
});
const down = (service) => ({
  service,
  status: 'down',
  version: null,
  builtAt: null,
  startedAt: null,
  latencyMs: null,
});

test('an admin sees the Admin tab with each service up or down, and refreshes it', async ({ page }) => {
  await signIn(page, 'admin');
  let reminders = down('reminders');
  let calls = 0;
  await page.route('**/admin/status', (route) => {
    calls += 1;
    route.fulfill({
      json: [up('gateway', '0.3.0'), up('users', '0.2.1'), reminders, up('notifications', '0.1.0')],
      headers: CORS,
    });
  });
  await page.goto('/');

  await page.getByText('Admin', { exact: true }).click();
  await expect(page.getByLabel('3 of 4 services up')).toBeVisible();
  await expect(page.getByText("Reminders isn't answering")).toBeVisible();
  await expect(page.getByLabel('Reminders down')).toBeVisible();
  await expect(page.getByText('0.2.1')).toBeVisible();
  await expect(page.getByText('up 1h 30m').first()).toBeVisible();

  // Reminders comes back: the refresh button asks again.
  reminders = up('reminders', '0.2.0');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByLabel('4 of 4 services up')).toBeVisible();
  await expect(page.getByText('Every service is answering')).toBeVisible();
  expect(calls).toBeGreaterThanOrEqual(2);
});

test('a user has no Admin tab, and a direct link says it is for admins', async ({ page }) => {
  await signIn(page, 'user');
  let asked = false;
  await page.route('**/admin/status', (route) => {
    asked = true;
    route.fulfill({ status: 403, json: { message: 'Admins only' }, headers: CORS });
  });
  await page.goto('/');
  await expect(page.getByText('Account', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin', { exact: true })).toHaveCount(0);

  await page.goto('/admin');
  await expect(page.getByText('This page is for admins.')).toBeVisible();
  await expect(page.getByText('Log In', { exact: true })).toHaveCount(0);
  expect(asked).toBe(false);
});
