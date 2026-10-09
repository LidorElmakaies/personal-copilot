const { test, expect } = require('@playwright/test');

// Location sync: signed in + a fresh GPS fix → PUT /users/me/location only when
// the server has no location, it's > 5 km away, or the time zone differs. Gateway fully mocked.

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const NEAR_TEL_AVIV = { lat: 32.1033, lon: 34.7818 }; // ~2 km north
const JERUSALEM = { lat: 31.7683, lon: 35.2137 }; // ~54 km away

const SHABBAT = {
  candleLighting: '2026-10-02T15:04:00.000Z',
  havdalah: '2026-10-03T16:00:00.000Z',
  parasha: null,
  holidays: [{ en: 'Shmini Atzeret', he: 'שמיני עצרת' }],
  isNow: false,
};

// Long enough for a sync that was going to happen to have sent its PUT.
const settle = (page) => page.waitForTimeout(1000);

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

// redux-persist on web: AsyncStorage → localStorage, each field JSON-stringified on its own.
async function signIn(page) {
  const token = fakeAccessToken();
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(token),
    refreshToken: JSON.stringify('fake-refresh'),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    window.localStorage.setItem('persist:auth', value);
  }, persisted);
  return token;
}

// Mocks Gateway: /calendar/shabbat, GET /users/me (with `savedLocation`), PUT /users/me/location.
// Returns the recorded profile GETs and location PUT bodies.
async function mockGateway(page, savedLocation) {
  const calls = { profileGets: 0, puts: [], putAuth: [] };
  const profile = (location) => ({ firstName: null, lastName: null, phone: null, location });

  await page.route('**/ws/**', (route) => route.abort()); // fake token — keep the socket off the real Gateway
  await page.route('**/calendar/shabbat?*', (route) =>
    route.fulfill({ json: SHABBAT, headers: CORS }),
  );
  await page.route('**/users/me', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() !== 'GET') return route.continue();
    calls.profileGets += 1;
    return route.fulfill({ json: profile(savedLocation), headers: CORS });
  });
  await page.route('**/users/me/location', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = req.postDataJSON();
    calls.puts.push({ method: req.method(), body });
    calls.putAuth.push(req.headers().authorization);
    return route.fulfill({
      json: profile({ ...body, updatedAt: new Date().toISOString() }),
      headers: CORS,
    });
  });
  return calls;
}

const isProfileGet = (r) => r.url().endsWith('/users/me') && r.request().method() === 'GET';
const isLocationPut = (r) =>
  r.url().endsWith('/users/me/location') && r.request().method() === 'PUT';

const saved = (where, tz) => ({ ...where, tz, updatedAt: '2026-10-01T10:00:00.000Z' });

test.describe('signed in, GPS in Tel Aviv, Asia/Jerusalem', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

  test('no saved location: sends the fix and the device time zone', async ({ page }) => {
    const token = await signIn(page);
    const calls = await mockGateway(page, null);
    const put = page.waitForResponse(isLocationPut);
    await page.goto('/');
    await put;
    await settle(page);

    expect(calls.puts).toEqual([
      { method: 'PUT', body: { lat: 32.0853, lon: 34.7818, tz: 'Asia/Jerusalem' } },
    ]);
    expect(calls.putAuth).toEqual([`Bearer ${token}`]);
  });

  test('saved location ~2 km away, same zone: sends nothing', async ({ page }) => {
    await signIn(page);
    const calls = await mockGateway(page, saved(NEAR_TEL_AVIV, 'Asia/Jerusalem'));
    const get = page.waitForResponse(isProfileGet);
    await page.goto('/');
    await get;
    await settle(page);

    expect(calls.profileGets).toBe(1);
    expect(calls.puts).toEqual([]);
  });

  test('saved location ~50 km away: sends the new fix', async ({ page }) => {
    await signIn(page);
    const calls = await mockGateway(page, saved(JERUSALEM, 'Asia/Jerusalem'));
    const put = page.waitForResponse(isLocationPut);
    await page.goto('/');
    await put;
    await settle(page);

    expect(calls.puts).toEqual([
      { method: 'PUT', body: { lat: 32.0853, lon: 34.7818, tz: 'Asia/Jerusalem' } },
    ]);
  });
});

test.describe('signed in, same place, device zone changed', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Europe/London' });

  test('saved in Asia/Jerusalem, device now Europe/London: sends the new zone', async ({ page }) => {
    await signIn(page);
    const calls = await mockGateway(
      page,
      saved({ lat: TEL_AVIV.latitude, lon: TEL_AVIV.longitude }, 'Asia/Jerusalem'),
    );
    const put = page.waitForResponse(isLocationPut);
    await page.goto('/');
    await put;
    await settle(page);

    expect(calls.puts).toEqual([
      { method: 'PUT', body: { lat: 32.0853, lon: 34.7818, tz: 'Europe/London' } },
    ]);
  });
});

test.describe('signed out', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

  test('never reads the profile or sends the location', async ({ page }) => {
    const calls = await mockGateway(page, null);
    // Shabbat is fetched for the GPS fix — proof the fresh fix arrived before we check.
    const fixUsed = page.waitForRequest(
      (r) => r.url().includes('/calendar/shabbat?') && r.url().includes('lat=32.0853'),
    );
    await page.goto('/');
    await fixUsed;
    await expect(page.getByText('Shabbat · Shmini Atzeret')).toBeVisible();
    await settle(page);

    expect(calls.profileGets).toBe(0);
    expect(calls.puts).toEqual([]);
  });
});
