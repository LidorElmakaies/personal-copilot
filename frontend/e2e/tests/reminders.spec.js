const { test, expect } = require('@playwright/test');

// Candle-lighting reminder (plan task 2.15): the bell under Home's Shabbat times and its offset
// sheet. Gateway mocked; clock starts on Sun 27 Sep 2026, candle lighting Fri 2 Oct 18:04 (local).

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const SHABBAT = {
  candleLighting: '2026-10-02T15:04:00.000Z', // 18:04 local
  havdalah: '2026-10-03T16:00:00.000Z',
  parasha: null,
  holidays: [{ en: 'Shmini Atzeret', he: 'שמיני עצרת' }],
  isNow: false,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

const BELL_OFF = 'Remind me before candle lighting';

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

// Mocks Gateway with `saved` as the user's reminders; `putStatus` lets a save fail. Returns the
// recorded PUT/DELETE calls.
async function mockGateway(page, { saved = [], putStatus = 200 } = {}) {
  const calls = { puts: [], deletes: [] };
  // Running from a fixed start, not frozen: the sheet's slide-in animation needs time to pass.
  await page.clock.install({ time: new Date('2026-09-27T08:00:00Z') });
  await page.clock.resume();
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ json: SHABBAT, headers: CORS }));
  await page.route('**/users/me**', (route) =>
    route.fulfill({
      json: { firstName: null, lastName: null, phone: null, location: null },
      headers: CORS,
    }),
  );
  await page.route('**/reminders', (route) => route.fulfill({ json: saved, headers: CORS }));
  await page.route('**/reminders/shabbat-candles', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'DELETE') {
      calls.deletes.push(req.headers().authorization);
      return route.fulfill({ status: 204, headers: CORS });
    }
    const body = req.postDataJSON();
    calls.puts.push({ body, auth: req.headers().authorization });
    if (putStatus !== 200) {
      return route.fulfill({ status: putStatus, json: { message: 'Something went wrong' }, headers: CORS });
    }
    const fire = new Date(Date.parse(SHABBAT.candleLighting) - body.offsetMinutes * 60000);
    return route.fulfill({
      json: {
        type: 'shabbat_candles',
        offsetMinutes: body.offsetMinutes,
        enabled: true,
        nextFireAt: fire.toISOString(),
        waitingForLocation: false,
      },
      headers: CORS,
    });
  });
  return calls;
}

const settle = (page) => page.waitForTimeout(800);

test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

test('signed out: the bell asks to log in, Yes goes to login', async ({ page }) => {
  await mockGateway(page);
  await page.goto('/');

  await page.getByText(BELL_OFF).click();
  await expect(page.getByText('Log in to set a reminder?')).toBeVisible();
  await page.getByText('Yes', { exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('no reminder yet: the sheet opens on 1h 30m, a preset changes it, Save sends only the offset', async ({ page }) => {
  const token = await signIn(page);
  const calls = await mockGateway(page);
  await page.goto('/');

  await page.getByText(BELL_OFF).click();
  await expect(page.getByLabel('1 hours')).toBeVisible();
  await expect(page.getByLabel('30 min')).toBeVisible();
  await expect(page.getByText('Every Friday · fires at 16:34 this week')).toBeVisible();
  await expect(page.getByText('Turn off', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/so the reminder won't reach you here/)).toBeVisible();
  await settle(page);
  await page.screenshot({ path: 'screenshots/reminder-sheet.png' });

  await page.getByText('2h', { exact: true }).click();
  await expect(page.getByLabel('2 hours')).toBeVisible();
  await expect(page.getByLabel('0 min')).toBeVisible();
  await page.getByLabel('More min').click();
  await expect(page.getByText('Every Friday · fires at 15:59 this week')).toBeVisible();

  await page.getByText('Save', { exact: true }).click();
  await expect(page.getByText('Reminder · 2h 5m before')).toBeVisible();
  await expect(page.getByText('Remind me before candle lighting', { exact: true })).toHaveCount(0);
  expect(calls.puts).toEqual([{ body: { offsetMinutes: 125 }, auth: `Bearer ${token}` }]);

  await settle(page);
  await page.screenshot({ path: 'screenshots/reminder-on.png' });
});

test('reminder on: the bell says so, the sheet shows the server time, Turn off turns it off', async ({ page }) => {
  const token = await signIn(page);
  const calls = await mockGateway(page, {
    saved: [
      {
        type: 'shabbat_candles',
        offsetMinutes: 45,
        enabled: true,
        nextFireAt: '2026-10-02T14:19:00.000Z', // 17:19 local
        waitingForLocation: false,
      },
    ],
  });
  await page.goto('/');

  await page.getByText('Reminder · 45m before').click();
  await expect(page.getByLabel('0 hours')).toBeVisible();
  await expect(page.getByLabel('45 min')).toBeVisible();
  await expect(page.getByText('Every Friday · fires at 17:19 this week')).toBeVisible();

  await page.getByText('Turn off', { exact: true }).click();
  await expect(page.getByText(BELL_OFF)).toBeVisible();
  expect(calls.deletes).toEqual([`Bearer ${token}`]);
  expect(calls.puts).toEqual([]);
});

test('a failed save keeps the sheet open with the error', async ({ page }) => {
  await signIn(page);
  await mockGateway(page, { putStatus: 500 });
  await page.goto('/');

  await page.getByText(BELL_OFF).click();
  await page.getByText('Save', { exact: true }).click();
  await expect(page.getByText('Something went wrong')).toBeVisible();
  await expect(page.getByText('Remind me before candle lighting', { exact: true }).last()).toBeVisible();
});

// Drags with the mouse from the middle of `locator` straight down by `dy` px, in small steps.
async function dragDown(page, locator, dy) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + (dy * i) / 10);
  await page.mouse.up();
}

const handleTop = async (page) => (await page.getByTestId('bottom-sheet-handle').boundingBox())?.y;

// Opens the sheet and waits until it has slid in and stopped (the test clock makes the slide-in
// lag behind real time, so a fixed wait isn't enough).
async function openSheet(page) {
  await page.getByText(BELL_OFF).click();
  const bottom = page.viewportSize().height;
  await expect.poll(() => handleTop(page)).toBeLessThan(bottom - 200);
  let last;
  await expect
    .poll(async () => {
      const now = await handleTop(page);
      const stopped = now === last;
      last = now;
      return stopped;
    })
    .toBe(true);
  return last;
}

const sheetTitle = (page) => page.getByText('Remind me before candle lighting', { exact: true });

test('dragging the sheet down far enough closes it without saving', async ({ page }) => {
  await signIn(page);
  const calls = await mockGateway(page);
  await page.goto('/');
  await openSheet(page);
  await expect(sheetTitle(page)).toHaveCount(2); // the bell and the sheet's title

  await dragDown(page, page.getByTestId('bottom-sheet-handle'), 250);
  await expect(sheetTitle(page)).toHaveCount(1); // only the bell is left
  expect(calls.puts).toEqual([]);
});

test('a short drag springs the sheet back open', async ({ page }) => {
  await signIn(page);
  await mockGateway(page);
  await page.goto('/');
  const open = await openSheet(page);

  await dragDown(page, page.getByTestId('bottom-sheet-handle'), 40);
  await expect.poll(async () => Math.abs((await handleTop(page)) - open)).toBeLessThan(2);
  await expect(page.getByText('Save', { exact: true })).toBeVisible();
});

test('a drag that starts on a button inside the sheet still moves it, and closes it', async ({ page }) => {
  await signIn(page);
  const calls = await mockGateway(page);
  await page.goto('/');
  await openSheet(page);

  await dragDown(page, page.getByText('2h', { exact: true }), 250);
  await expect(sheetTitle(page)).toHaveCount(1);
  expect(calls.puts).toEqual([]);
});

test('a touch drag (finger, as on the phone) closes it too', async ({ page }) => {
  await signIn(page);
  const calls = await mockGateway(page);
  await page.goto('/');
  await openSheet(page);

  const box = await page.getByTestId('bottom-sheet-handle').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, dy) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: dy === null ? [] : [{ x, y: y + dy }] });
  await touch('touchStart', 0);
  for (let i = 1; i <= 10; i++) await touch('touchMove', 25 * i);
  await touch('touchEnd', null);

  await expect(sheetTitle(page)).toHaveCount(1);
  expect(calls.puts).toEqual([]);
});
