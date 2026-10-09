const { test, expect } = require('@playwright/test');

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
// A real GET /calendar/shabbat answer for Tel Aviv, week of 2 Oct 2026.
const SHMINI_ATZERET = {
  candleLighting: '2026-10-02T15:04:00.000Z', // 18:04 local
  havdalah: '2026-10-03T16:00:00.000Z', // 19:00 local
  parasha: null,
  holidays: [{ en: 'Shmini Atzeret', he: 'שמיני עצרת' }],
  isNow: false,
};

const settle = (page) => page.waitForTimeout(800);

// Freezes the clock and answers /calendar/shabbat with `body`; returns the captured request URLs.
async function mockShabbat(page, at, body) {
  const requests = [];
  await page.clock.setFixedTime(new Date(at));
  await page.route('**/calendar/shabbat?*', (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({ json: body });
  });
  return requests;
}

test.describe('with location allowed', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

  test('before Shabbat: times, occasion, and countdown to candle lighting', async ({ page }) => {
    const requests = await mockShabbat(page, '2026-09-27T08:00:00Z', SHMINI_ATZERET);
    await page.goto('/');

    await expect(page.getByText('Shabbat · Shmini Atzeret')).toBeVisible();
    await expect(page.getByText('18:04')).toBeVisible();
    await expect(page.getByText('19:00')).toBeVisible();
    await expect(page.getByText('Fri 2 Oct')).toBeVisible();
    await expect(page.getByLabel('5 days 7 hours 4 minutes until candle lighting')).toBeVisible();

    const last = requests.at(-1);
    expect(last.searchParams.get('lat')).toBe('32.0853');
    expect(last.searchParams.get('lon')).toBe('34.7818');
    expect(last.searchParams.get('tz')).toBe('Asia/Jerusalem');

    await settle(page);
    await page.screenshot({ path: 'screenshots/shabbat-upcoming.png', fullPage: true });
  });

  test('during Shabbat: greeting and countdown to Havdalah', async ({ page }) => {
    await mockShabbat(page, '2026-10-03T10:00:00Z', { ...SHMINI_ATZERET, isNow: true });
    await page.goto('/');

    await expect(page.getByText('Shabbat Shalom')).toBeVisible();
    await expect(page.getByLabel('0 days 6 hours 0 minutes until Havdalah')).toBeVisible();

    await settle(page);
    await page.screenshot({ path: 'screenshots/shabbat-in-progress.png', fullPage: true });
  });

  test('real backend: shows times for this location', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Candle lighting', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/until (candle lighting|Havdalah)$/)).toBeVisible();
  });
});

test.describe('with location refused', () => {
  test.use({ permissions: [], timezoneId: 'Asia/Jerusalem' });

  test('explains location is off and offers Retry', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Location is off/)).toBeVisible();
    await expect(page.getByText('Retry', { exact: true })).toBeVisible();

    await settle(page);
    await page.screenshot({ path: 'screenshots/shabbat-location-off.png', fullPage: true });
  });
});
