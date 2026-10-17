const { test, expect } = require('@playwright/test');

// A day with many reminders on the Calendar tab (mockup B2): the cell's count, the card's preview
// and the "Show all" sheet, at 120 and 500. Per-day reminders don't exist yet, so the Admin tab's
// sample switch fills them; signed in as an admin with a fake token, Gateway mocked.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};
const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };

function fakeAccessToken() {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'e2e@example.com',
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

function monthBody(year, month) {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => ({
    date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
    hebrew: { day: i + 1, dayHe: `ה${i + 1}`, month: { en: 'Cheshvan', he: 'חשון' }, year: 5787, yearHe: 'תשפ״ז' },
    events: [],
    parasha: null,
    times: [],
  }));
  return { year, month, days };
}

// Signed in as an admin, the clock on Sat 17 Oct 2026, then the sample switch turned on from the
// Admin tab and the Calendar tab opened through the tab bar (the samples live in memory only).
async function openWithSamples(page) {
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
  await page.clock.setFixedTime(new Date('2026-10-17T08:00:00Z'));
  await page.route('**/ws/**', (route) => route.abort());
  // Signed-in calls the screens make on their own (location sync, profile, push): answered here,
  // or the real Gateway refuses the fake token and the session ends.
  for (const path of ['**/users/**', '**/auth/**', '**/notifications/**', '**/realtime/**']) {
    await page.route(path, (route) => route.fulfill({ json: {}, headers: CORS }));
  }
  await page.route('**/admin/status', (route) => route.fulfill({ json: [], headers: CORS }));
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/reminders', (route) => route.fulfill({ json: [], headers: CORS }));
  await page.route('**/calendar/month?*', (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: monthBody(Number(url.searchParams.get('year')), Number(url.searchParams.get('month'))),
      headers: CORS,
    });
  });

  await page.goto('/admin');
  await page.getByLabel('Sample reminders on the calendar').click();
  await expect(page.getByText(/^On · 120 on the 24th/)).toBeVisible();
  await page.getByText('Calendar', { exact: true }).click();
  await expect(page.getByText('October 2026')).toBeVisible();
}

const day = (page, label) => page.getByLabel(label, { exact: false });

// Scrolls the sheet's list down by `px`, in wheel steps (Chrome's synthetic touch scroll doesn't
// move anything in this headless phone emulation, not even the page — finger scrolling is checked
// on the phone).
async function scrollList(page, px) {
  const { width, height } = page.viewportSize();
  await page.mouse.move(width / 2, height * 0.75);
  for (let done = 0; done < px; done += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
}

// The hour header pinned at the top of the list: of the headers stuck at its top edge, the last
// one (it's drawn over the earlier ones).
const pinnedHour = (page) =>
  page.evaluate(() => {
    const headers = [...document.querySelectorAll('[role="heading"]')];
    let list = headers[0];
    while (list && getComputedStyle(list).overflowY !== 'auto') list = list.parentElement;
    const top = list.getBoundingClientRect().top;
    const stuck = headers.filter((h) => Math.abs(h.getBoundingClientRect().top - top) < 2);
    return stuck.at(-1)?.textContent;
  });

test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

test('the busy day: 99+ in its cell, cells keep one size, the card keeps its size', async ({ page }) => {
  await openWithSamples(page);

  const busy = day(page, 'Saturday, October 24,');
  await expect(busy).toHaveAttribute('aria-label', /, 120 reminders$/);
  await expect(busy.getByText('99+')).toBeVisible();
  await expect(day(page, 'Monday, October 19,').getByText('7', { exact: true })).toBeVisible();

  // Every cell in the month the same height, busy or not.
  const heights = await page.locator('[aria-label*=", October "]').evaluateAll((els) => [
    ...new Set(els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height))),
  ]);
  expect(heights).toHaveLength(1);

  await busy.click();
  await expect(page.getByText('Your reminders')).toBeVisible();
  await expect(page.getByText('120', { exact: true })).toBeVisible();
  await expect(page.getByText('+117 more · Show all')).toBeVisible();
  // The card ends a short way under the month — it doesn't grow to fit 120.
  const lastRow = await day(page, 'Saturday, October 31,').boundingBox();
  const more = await page.getByText('+117 more · Show all').boundingBox();
  expect(more.y + more.height - (lastRow.y + lastRow.height)).toBeLessThan(450);

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/busy-day-card.png', fullPage: true });
});

test('Show all: every reminder grouped by hour, the hour pinned while the list scrolls', async ({ page }) => {
  await openWithSamples(page);
  await day(page, 'Saturday, October 24,').click();
  await page.getByText('+117 more · Show all').click();

  await expect(page.getByText('120 reminders · Saturday 24 October')).toBeVisible();
  const sheetTop = (await page.getByText('120 reminders · Saturday 24 October').boundingBox()).y;
  expect(sheetTop).toBeGreaterThan(page.viewportSize().height * 0.2); // a sheet, not a whole page

  // The first hour's header, then scroll the list: a later hour's header is pinned at the top.
  const headers = page.getByRole('heading');
  await expect(headers.first()).toHaveText(/^0[6-9]:00\d+$/);
  const firstHour = await headers.first().textContent();
  expect(await pinnedHour(page)).toBe(firstHour);
  await expect(async () => {
    await scrollList(page, 1200);
    const pinned = await pinnedHour(page);
    expect(pinned).toMatch(/^\d\d:00\d+$/);
    expect(pinned).not.toBe(firstHour);
  }).toPass({ timeout: 10000 });
  await page.screenshot({ path: 'screenshots/busy-day-sheet.png' });

  await page.getByText('Close', { exact: true }).click();
  await expect(page.getByText('120 reminders · Saturday 24 October')).toHaveCount(0);
});

test('500 on one day: the sheet opens fast and reaches the last one', async ({ page }) => {
  await openWithSamples(page);
  await day(page, 'Saturday, October 10,').click();
  await expect(page.getByText('+497 more · Show all')).toBeVisible();

  const t0 = Date.now();
  await page.getByText('+497 more · Show all').click();
  await expect(page.getByText('500 reminders · Saturday 10 October')).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(1500);
  // Virtualized: far fewer than 500 rows are in the page at once.
  const rendered = await page.getByRole('heading').count();
  expect(rendered).toBeLessThan(19); // 06:00–23:00 at most, and usually fewer mounted

  // 500 rows: keep scrolling until the last hour is the one pinned.
  await expect(async () => {
    await scrollList(page, 6000);
    expect(await pinnedHour(page)).toMatch(/^23:00/);
  }).toPass({ timeout: 20000 });
});

test('swiping months still works with the samples on, and counts come along', async ({ page }) => {
  await openWithSamples(page);
  await page.getByLabel('Next month').click();
  await expect(page.getByText('November 2026')).toBeVisible();
  await expect(day(page, 'Tuesday, November 24,')).toHaveAttribute('aria-label', /, 120 reminders$/);
  await page.getByLabel('Previous month').click();
  await expect(page.getByText('October 2026')).toBeVisible();
});
