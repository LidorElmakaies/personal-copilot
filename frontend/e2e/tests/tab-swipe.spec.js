const { test, expect } = require('@playwright/test');

// Swiping between tabs: signed out, as a user and as an admin. Gateway mocked, signed in
// with a fake token (as admin.spec.js); the Calendar's months are made up (as calendar.spec.js).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};
const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };

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

async function mockGateway(page) {
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/realtime/device', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/reminders', (route) => route.fulfill({ json: [], headers: CORS }));
  await page.route('**/users/me', (route) => route.fulfill({ json: { firstName: null, lastName: null, phone: null }, headers: CORS }));
  await page.route('**/admin/status', (route) => route.fulfill({ json: [], headers: CORS }));
  await page.route('**/calendar/month?*', (route) => {
    const url = new URL(route.request().url());
    const year = +url.searchParams.get('year');
    const month = +url.searchParams.get('month');
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days = Array.from({ length: count }, (_, i) => ({
      date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      hebrew: { day: i + 1, dayHe: `ה${i + 1}`, month: { en: 'Tishrei', he: 'תשרי' }, year: 5787, yearHe: 'תשפ״ז' },
      events: [],
      parasha: null,
      times: [],
    }));
    return route.fulfill({ json: { year, month, days }, headers: CORS });
  });
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
}

// A finger dragged across the screen at height `y` (default: the middle), `by` screen-widths
// sideways (negative: to the left = the next tab), starting `from` px in from the side it leaves.
async function swipe(page, by, { y, from = 60, steps = 20 } = {}) {
  const { width, height } = page.viewportSize();
  y ??= height / 2;
  let x = by < 0 ? width - from : from;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x, y, id: 1 }]);
  for (let i = 1; i <= steps; i++) {
    x += (by * width) / steps;
    await touch('touchMove', [{ x, y, id: 1 }]);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(120);
  await touch('touchEnd', []);
  await cdp.detach();
  await page.waitForTimeout(500);
}

// The tab shown: its route is the URL.
async function expectTab(page, path) {
  await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`));
}
// Whether `text`'s element is inside the screen horizontally (the other tabs sit beside it).
async function inView(page, locator) {
  const box = await locator.first().boundingBox();
  const { width } = page.viewportSize();
  return !!box && box.x >= 0 && box.x + box.width <= width + 1;
}
const monthTitle = (page) =>
  page.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/);

test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

test('signed out: swipe Home → Calendar; onto Account it springs back and asks to log in', async ({ page }) => {
  await mockGateway(page);
  await page.goto('/');
  await expect(page.getByText('Calendar', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin', { exact: true })).toHaveCount(0);

  await swipe(page, 0.6); // past the first tab: stays
  await expectTab(page, '/');

  await swipe(page, -0.6);
  await expectTab(page, '/calendar');
  expect(await inView(page, monthTitle(page))).toBe(true);

  // On the day card, below the month grid: tabs, not months.
  const title = await monthTitle(page).textContent();
  await swipe(page, -0.6, { y: page.viewportSize().height - 160 });
  await expect(page.getByText('Log in to view Account?')).toBeVisible();
  await expectTab(page, '/calendar');
  expect(await inView(page, monthTitle(page))).toBe(true);
  await expect(monthTitle(page)).toHaveText(title);
  await page.getByText('No', { exact: true }).click();
  await expect(page.getByText('Log in to view Account?')).toHaveCount(0);

  // A tap asks the same.
  await page.getByText('Account', { exact: true }).last().click(); // the bar's, after the screens
  await expect(page.getByText('Log in to view Account?')).toBeVisible();
  await page.getByText('Yes', { exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('signed out: a swipe starting at the screen edge is left to the system', async ({ page }) => {
  await mockGateway(page);
  await page.goto('/');
  await expect(page.getByText('Calendar', { exact: true })).toBeVisible();
  await swipe(page, -0.6, { from: 6 });
  await expectTab(page, '/');
  await swipe(page, -0.6);
  await expectTab(page, '/calendar');
});

test('the Calendar month grid still swipes months, not tabs', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-27T08:00:00Z'));
  await mockGateway(page);
  await page.goto('/calendar');
  await expect(monthTitle(page)).toHaveText('September 2026');
  const cell = await page.getByLabel(', September 16,', { exact: false }).boundingBox();
  await swipe(page, -0.6, { y: cell.y + cell.height / 2 });
  await expect(monthTitle(page)).toHaveText('October 2026');
  await expectTab(page, '/calendar');
  await swipe(page, 0.6, { y: cell.y + cell.height / 2 });
  await expect(monthTitle(page)).toHaveText('September 2026');
  await expectTab(page, '/calendar');
});

test('a user swipes through Home, Calendar and Account, and never reaches Admin', async ({ page }) => {
  test.slow(); // a swipe is about a second, and this does many
  await signIn(page, 'user');
  await mockGateway(page);
  await page.goto('/');
  await expect(page.getByText('Account', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin', { exact: true })).toHaveCount(0);

  await swipe(page, -0.6);
  await expectTab(page, '/calendar');
  await swipe(page, -0.6, { y: 40 });
  await expectTab(page, '/account');
  await expect(page.getByText('Log in to view Account?')).toHaveCount(0);

  // Account is the last tab: past it, nothing — over and over.
  for (let i = 0; i < 3; i++) {
    await swipe(page, -0.9);
    await expectTab(page, '/account');
  }
  await expect(page.getByText('This page is for admins.')).toHaveCount(0);
  await expect(page.getByText('System status')).toHaveCount(0);

  // And back, one tab per swipe.
  await swipe(page, 0.6, { y: 40 });
  await expectTab(page, '/calendar');
  await swipe(page, 0.6, { y: 40 });
  await expectTab(page, '/');
});

test('a user on a direct /admin link sees "for admins", and the swipe is off there', async ({ page }) => {
  await signIn(page, 'user');
  await mockGateway(page);
  await page.goto('/admin');
  await expect(page.getByText('This page is for admins.')).toBeVisible();
  await swipe(page, 0.6);
  await swipe(page, -0.6);
  await expectTab(page, '/admin');
  await page.getByText('Home', { exact: true }).click();
  await expectTab(page, '/');
  await swipe(page, -0.6);
  await expectTab(page, '/calendar');
});

test('an admin swipes all the way to Admin, and a tap jumps back to Home', async ({ page }) => {
  test.slow(); // a swipe is about a second, and this does many
  await signIn(page, 'admin');
  await mockGateway(page);
  await page.goto('/');
  await expect(page.getByText('Admin', { exact: true })).toBeVisible();

  await swipe(page, -0.6);
  await expectTab(page, '/calendar');
  await swipe(page, -0.6, { y: 40 });
  await expectTab(page, '/account');
  await swipe(page, -0.6, { y: 40 });
  await expectTab(page, '/admin');
  await swipe(page, -0.9); // the last tab: stays
  await expectTab(page, '/admin');

  await page.getByText('Home', { exact: true }).click();
  await expectTab(page, '/');
  await page.waitForTimeout(400);
  const clock = page.getByText(/^\d{2}:\d{2}:\d{2}$/);
  expect(await inView(page, clock)).toBe(true);
});
