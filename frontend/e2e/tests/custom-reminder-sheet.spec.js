const { test, expect } = require('@playwright/test');

// The add/edit sheet's own behaviour around the server, against a fake Gateway: the
// title rule, a refused save, a once-reminder in the past, the + clearing the last reminder, and
// signing out. custom-reminders.spec.js covers the real repeat rules against the real backend.
// Signed in with a fake token; the clock starts Sat 17 Oct 2026, 11:00 in Israel, and keeps running
// (BottomSheet slides in with JS animations — see reminders.spec.js).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};
const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const NOW = new Date('2026-10-17T08:00:00Z'); // Sat 17 Oct 2026, 11:00 in Israel

test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

function fakeAccessToken() {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'e2e@example.com',
    role: 'user',
    exp: Math.floor(NOW.getTime() / 1000) + 2 * 86400, // covers the later clocks some tests use
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

const plusDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// A small stand-in for the Reminders Service: once and daily reminders only (enough for these
// tests), skip, PATCH, DELETE. `fail` makes the next calls of a kind answer an error instead;
// `delay` (ms, by kind) holds a kind's answers back — a list as it was when asked, a change saved
// only once its time is up.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function fakeReminders() {
  const store = { reminders: [], calls: [], fail: {}, delay: {} };
  let next = 1;
  const datesOf = (r, from, to) => {
    if (r.repeat === 'once') return r.start >= from && r.start <= to && !r.skipped.includes(r.start) ? [r.start] : [];
    const dates = [];
    for (let d = r.start > from ? r.start : from; d <= to; d = plusDays(d, 1)) if (!r.skipped.includes(d)) dates.push(d);
    return dates;
  };
  store.handle = async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/reminders\/custom/, '');
    const kind = `${req.method()} ${path.replace(/^\/[^/]+/, path.startsWith('/preview') ? '/preview' : '/:id')}`;
    store.calls.push({ kind, body: req.postDataJSON?.() ?? null });
    const failure = store.fail[kind];
    if (failure) {
      delete store.fail[kind];
      return route.fulfill({ status: failure.status, json: { message: failure.message }, headers: CORS });
    }
    const find = () => store.reminders.find((r) => r.id === path.split('/')[1]);
    // A change's body may carry the months shown ({ from, to }): the answer then has the reminder's
    // `dates` there, like the real service.
    const { from: showFrom, to: showTo, ...body } = req.postDataJSON?.() ?? {};
    const answer = (r) => (showFrom ? { ...r, dates: datesOf(r, showFrom, showTo) } : r);
    switch (kind) {
      case 'GET ': {
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const json = store.reminders.map((r) => ({ ...r, skipped: [...r.skipped], dates: datesOf(r, from, to) }));
        if (store.delay[kind]) await wait(store.delay[kind]);
        return route.fulfill({ json, headers: CORS });
      }
      case 'GET /preview': {
        const r = { start: url.searchParams.get('start'), repeat: url.searchParams.get('repeat'), skipped: [] };
        const at = (d) => new Date(`${d}T${String(url.searchParams.get('hour')).padStart(2, '0')}:${String(url.searchParams.get('minute')).padStart(2, '0')}:00+03:00`);
        const dates = datesOf(r, r.start, plusDays(r.start, 10)).filter((d) => at(d) > NOW).slice(0, 3);
        return route.fulfill({ json: { next: dates }, headers: CORS });
      }
      case 'POST ': {
        if (store.delay[kind]) await wait(store.delay[kind]);
        const r = { id: `new-${next++}`, calendar: 'gregorian', skipped: [], ...body };
        store.reminders.push(r);
        return route.fulfill({ status: 201, json: answer(r), headers: CORS });
      }
      case 'PATCH /:id':
        Object.assign(find(), body);
        return route.fulfill({ json: answer(find()), headers: CORS });
      case 'DELETE /:id':
        store.reminders = store.reminders.filter((r) => r !== find());
        return route.fulfill({ status: 204, headers: CORS });
      case 'POST /:id/skip':
        find().skipped.push(body.date);
        return route.fulfill({ json: answer(find()), headers: CORS });
      default:
        return route.fulfill({ status: 404, json: { message: 'not here' }, headers: CORS });
    }
  };
  return store;
}

// Signed in (fake token), Gateway mocked, the Calendar tab open on October 2026.
async function open(page, reminders = fakeReminders(), now = NOW) {
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
  await page.clock.install({ time: now });
  await page.clock.resume();
  // Everything off the app's own origin: 503, unless routed below (a 401 from the real Gateway
  // would end the fake session).
  const appOrigin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:8081').origin;
  await page.route(
    (url) => url.origin !== appOrigin,
    (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : route.fulfill({ status: 503, json: { message: 'unavailable' }, headers: CORS }),
  );
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/users/me', (route) => route.fulfill({ json: { firstName: null, lastName: null, phone: null, location: null }, headers: CORS }));
  await page.route('**/users/me/location', (route) => route.fulfill({ json: {}, headers: CORS }));
  await page.route('**/reminders', (route) => route.fulfill({ json: [], headers: CORS }));
  await page.route('**/auth/logout', (route) => route.fulfill({ status: 204, headers: CORS }));
  await page.route('**/calendar/month?*', (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: monthBody(Number(url.searchParams.get('year')), Number(url.searchParams.get('month'))),
      headers: CORS,
    });
  });
  await page.route('**/reminders/custom**', reminders.handle);
  await page.goto('/calendar');
  await expect(page.getByText('October 2026')).toBeVisible();
  return reminders;
}

const cell = (page, label) => page.getByLabel(new RegExp(`^${label},`));
const button = (page, text) => page.getByRole('dialog').getByText(text, { exact: true });
const title = (page) => page.getByPlaceholder('e.g. Call Grandma');

async function startNew(page, day, text) {
  await cell(page, day).click();
  await page.getByLabel('Add reminder').click();
  await expect(page.getByText('New reminder')).toBeVisible();
  await title(page).fill(text);
}

test('the title follows the server\'s rule: Save stays off and says what to fix', async ({ page }) => {
  await open(page);
  await startNew(page, 'Tuesday, October 20', 'Call  Grandma');
  const disabledSave = page.getByRole('dialog').locator('[aria-disabled="true"]', { hasText: /^Save$/ });
  await expect(page.getByText(/single spaces/)).toBeVisible();
  await expect(disabledSave).toHaveCount(1);

  // A phone keyboard's curly quotes are straightened as they're typed.
  await title(page).fill('Mom’s “big” day');
  await expect(title(page)).toHaveValue('Mom\'s "big" day');
  await expect(disabledSave).toHaveCount(0);

  // The kinds of text a phone keyboard really produces.
  for (const bad of ['Party 🎉', 'Call\tGrandma']) {
    await title(page).fill(bad);
    await expect(page.getByText(/single spaces/)).toBeVisible();
  }
  for (const good of ['Call Grandma', 'יום הולדת לסבא', 'Pay rent (Oct) - 3/4!', '  Trailing spaces are fine  ']) {
    await title(page).fill(good);
    await expect(page.getByText(/single spaces/)).toHaveCount(0);
    await expect(disabledSave).toHaveCount(0);
  }
});

test('a save the server refuses: its message in the sheet, the form kept, nothing on the grid', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.fail['POST '] = { status: 422, message: 'At most 300 reminders' };
  await open(page, reminders);
  await startNew(page, 'Tuesday, October 20', 'Dentist');
  await button(page, 'Save').click();

  await expect(page.getByRole('dialog').getByText('At most 300 reminders')).toBeVisible();
  await expect(title(page)).toHaveValue('Dentist');
  await expect(cell(page, 'Tuesday, October 20')).not.toHaveAccessibleName(/reminder/);

  // Trying again works, and the error goes.
  await button(page, 'Save').click();
  await expect(page.getByText('New reminder')).toHaveCount(0);
  await expect(cell(page, 'Tuesday, October 20')).toHaveAccessibleName(/, 1 reminder$/);
  await page.getByLabel('Add reminder').click();
  await expect(page.getByRole('dialog').getByText('At most 300 reminders')).toHaveCount(0);
});

test('a once-reminder already past: the sheet says it won\'t go off; saved, it shows dimmed as done', async ({ page }) => {
  await open(page);
  await startNew(page, 'Saturday, October 17', 'Coffee');
  await page.getByLabel('Fewer hours').click(); // 18:00
  for (let h = 18; h > 9; h--) await page.getByLabel('Fewer hours').click(); // 09:00, before 11:00
  await expect(page.getByLabel('Next dates')).toContainText("That time has passed — it won't go off.");
  await button(page, 'Save').click();
  await expect(page.getByText('New reminder')).toHaveCount(0);

  const row = page.getByLabel('Coffee, 09:00, done');
  await expect(row).toBeVisible();
  await expect(row).toHaveCSS('opacity', '0.5');
  await expect(page.getByText('Done · Once · Sat 17 Oct')).toBeVisible();
});

test('the + never hides the last reminder: scrolled to the end, the card clears it', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.reminders = ['Alpha', 'Bravo', 'Charlie'].map((t, i) => ({
    id: `r${i}`, title: t, hour: 20 + i, minute: 0, repeat: 'daily', calendar: 'gregorian', start: '2026-10-01', skipped: [],
  }));
  await open(page, reminders);
  await cell(page, 'Tuesday, October 20').click();
  const last = page.getByLabel('Charlie, 22:00');
  await expect(last).toBeVisible();
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(400);

  const box = async (locator) => locator.boundingBox();
  const fab = await box(page.getByLabel('Add reminder'));
  const row = await box(last);
  const more = page.getByText(/Show all/);
  const below = (await more.count()) ? await box(more) : row;
  expect(row.y + row.height).toBeLessThanOrEqual(fab.y);
  expect(below.y + below.height).toBeLessThanOrEqual(fab.y);
});

test('signing out takes the reminders off the grid and the card', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.reminders = [
    { id: 'r1', title: 'Walk', hour: 20, minute: 0, repeat: 'daily', calendar: 'gregorian', start: '2026-10-01', skipped: [] },
  ];
  await open(page, reminders);
  await cell(page, 'Tuesday, October 20').click();
  await expect(cell(page, 'Tuesday, October 20')).toHaveAccessibleName(/, 1 reminder$/);
  await expect(page.getByLabel('Walk, 20:00')).toBeVisible();

  await page.getByText('Account', { exact: true }).last().click();
  await page.getByText('Log Out', { exact: true }).click();
  await expect(page.getByText('Log out of your account?')).toBeVisible();
  await page.getByText('Log Out', { exact: true }).first().click();
  await expect(page.getByText('You need to log in to view your account.')).toBeVisible();

  await page.getByText('Calendar', { exact: true }).last().click();
  await expect(cell(page, 'Tuesday, October 20')).not.toHaveAccessibleName(/reminder/);
  await expect(page.getByLabel('Walk, 20:00')).toHaveCount(0);
  await page.getByLabel('Add reminder').click();
  await expect(page.getByText('Log in to add reminders?')).toBeVisible();
});

// "Only this day" on an edit is two calls: the day's own once-reminder first, then the series
// skips the day. A failure in between leaves the day twice, never missing.
test('"Only this day" edit that the server refuses keeps the day\'s reminder', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.reminders = [
    { id: 'r1', title: 'Vitamins', hour: 20, minute: 0, repeat: 'daily', calendar: 'gregorian', start: '2026-10-01', skipped: [] },
  ];
  await open(page, reminders);
  await cell(page, 'Tuesday, October 20').click();
  await page.getByLabel('Vitamins, 20:00').click();
  await title(page).fill('Vitamin D');
  await button(page, 'Save').click();
  reminders.fail['POST '] = { status: 422, message: 'At most 300 reminders' };
  await button(page, 'Only Tue 20 Oct').click();
  await expect(page.getByRole('dialog').getByText('At most 300 reminders')).toBeVisible();

  // On the server, Tue 20 still has a reminder: the series' own, or its once-reminder.
  const day = '2026-10-20';
  const series = reminders.reminders.find((r) => r.id === 'r1');
  const ownOnce = reminders.reminders.find((r) => r.repeat === 'once' && r.start === day);
  expect(!series.skipped.includes(day) || !!ownOnce).toBe(true);
});

test('a failed skip after the day\'s own reminder was made: both show, nothing is lost', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.reminders = [
    { id: 'r1', title: 'Vitamins', hour: 20, minute: 0, repeat: 'daily', calendar: 'gregorian', start: '2026-10-01', skipped: [] },
  ];
  await open(page, reminders);
  await cell(page, 'Tuesday, October 20').click();
  await page.getByLabel('Vitamins, 20:00').click();
  await title(page).fill('Vitamin D');
  await button(page, 'Save').click();
  reminders.fail['POST /:id/skip'] = { status: 503, message: 'unavailable' };
  await button(page, 'Only Tue 20 Oct').click();
  await expect(page.getByRole('dialog').getByText('unavailable')).toBeVisible();

  await button(page, 'Close').click();
  await expect(page.getByLabel('Vitamin D, 20:00')).toBeVisible();
  await expect(page.getByLabel('Vitamins, 20:00')).toBeVisible();
  await expect(cell(page, 'Tuesday, October 20')).toHaveAccessibleName(/, 2 reminders$/);
});

test('a change uses the server\'s answer: no second request for the list', async ({ page }) => {
  const reminders = await open(page);
  await startNew(page, 'Tuesday, October 20', 'Dentist');
  const listsBefore = reminders.calls.filter((c) => c.kind === 'GET ').length;
  await button(page, 'Save').click();
  await expect(page.getByText('New reminder')).toHaveCount(0);
  await expect(cell(page, 'Tuesday, October 20')).toHaveAccessibleName(/, 1 reminder$/);

  const post = reminders.calls.find((c) => c.kind === 'POST ');
  expect(post.body).toMatchObject({ title: 'Dentist', from: expect.any(String), to: expect.any(String) });
  expect(reminders.calls.filter((c) => c.kind === 'GET ').length).toBe(listsBefore);

  // Delete needs no answer at all: it just goes.
  await page.getByLabel('Dentist, 19:00').click();
  await button(page, 'Delete').click();
  await button(page, 'Delete').click();
  await expect(cell(page, 'Tuesday, October 20')).not.toHaveAccessibleName(/reminder/);
  expect(reminders.calls.filter((c) => c.kind === 'GET ').length).toBe(listsBefore);
});

// "Only <day>" makes that one day a once-reminder on the same date, so it's offered only while the
// edit keeps the day where it is: a new start, repeat or calendar is for the whole series.
test('"Only this day" is offered only while the edit keeps the date, repeat and calendar', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.reminders = [
    { id: 'r1', title: 'Vitamins', hour: 20, minute: 0, repeat: 'daily', calendar: 'gregorian', start: '2026-10-01', skipped: [] },
    { id: 'r2', title: 'Rent', hour: 9, minute: 0, repeat: 'monthly', calendar: 'gregorian', start: '2026-09-20', skipped: [] },
  ];
  await open(page, reminders);
  await cell(page, 'Tuesday, October 20').click();
  const only = button(page, 'Only Tue 20 Oct');
  const choose = async () => {
    await button(page, 'Save').click();
    await expect(button(page, 'Every time')).toBeVisible();
  };
  const back = () => button(page, 'Cancel').click();

  await page.getByLabel('Vitamins, 20:00').click();
  // Title and time: still that one day.
  await title(page).fill('Vitamin D');
  await page.getByLabel('More hours').click();
  await choose();
  await expect(only).toBeVisible();
  await back();

  // A new start date: the series only.
  await page.getByLabel('Day after').click();
  await choose();
  await expect(only).toHaveCount(0);
  await back();
  // …and back to the same date: offered again.
  await page.getByLabel('Day before').click();
  await choose();
  await expect(only).toBeVisible();
  await back();

  // A new repeat: the series only.
  await button(page, 'Monthly').click();
  await choose();
  await expect(only).toHaveCount(0);
  await back();
  await button(page, 'Daily').click();

  // Delete still offers just this day, whatever the form says.
  await page.getByLabel('Day after').click();
  await button(page, 'Delete').click();
  await expect(button(page, 'Every time')).toBeVisible();
  await expect(only).toBeVisible();
  await back();
  await button(page, 'Close').click();
  await expect(page.getByText('Edit reminder')).toHaveCount(0);

  // A new calendar on a monthly one: the series only.
  await page.getByLabel('Rent, 09:00').click();
  await page.getByRole('dialog').getByText(/^Hebrew · /).click();
  await choose();
  await expect(only).toHaveCount(0);
  await back();
  await page.getByRole('dialog').getByText(/^Gregorian · /).click();
  await choose();
  await expect(only).toBeVisible();

  // Nothing was sent for any of it.
  expect(reminders.calls.filter((c) => c.kind !== 'GET ' && c.kind !== 'GET /preview')).toEqual([]);
});

// A once-reminder is done once its minute has come in Israel, whatever zone the phone is set to.
// The clock is 11:00 in Israel: 04:00 in New York, 17:00 in Tokyo.
for (const [zone, local] of [['America/New_York', '04:00'], ['Asia/Tokyo', '17:00']]) {
  test.describe(`with the phone set to ${zone} (${local} there)`, () => {
    test.use({ timezoneId: zone });

    test('a once-reminder is done by Israel\'s clock, not the phone\'s', async ({ page }) => {
      const reminders = fakeReminders();
      reminders.reminders = [
        { id: 'r1', title: 'Before', hour: 9, minute: 0, repeat: 'once', calendar: 'gregorian', start: '2026-10-17', skipped: [] },
        { id: 'r2', title: 'Exactly', hour: 11, minute: 0, repeat: 'once', calendar: 'gregorian', start: '2026-10-17', skipped: [] },
        { id: 'r3', title: 'After', hour: 14, minute: 0, repeat: 'once', calendar: 'gregorian', start: '2026-10-17', skipped: [] },
      ];
      await open(page, reminders);
      await cell(page, 'Saturday, October 17').click();
      await expect(page.getByLabel('Before, 09:00, done')).toBeVisible();
      await expect(page.getByLabel('Exactly, 11:00, done')).toBeVisible(); // its minute has come
      await expect(page.getByLabel('After, 14:00', { exact: true })).toBeVisible();
      await expect(page.getByLabel('After, 14:00', { exact: true })).toHaveCSS('opacity', '1');
    });
  });
}

test('a once-reminder dims when its minute comes, with no reload', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.reminders = [
    { id: 'r1', title: 'Soon', hour: 11, minute: 1, repeat: 'once', calendar: 'gregorian', start: '2026-10-17', skipped: [] },
  ];
  await open(page, reminders);
  await cell(page, 'Saturday, October 17').click();
  await expect(page.getByLabel('Soon, 11:01', { exact: true })).toBeVisible();

  await page.clock.fastForward(65_000); // past 11:01, and past the next once-a-minute tick
  const done = page.getByLabel('Soon, 11:01, done');
  await expect(done).toBeVisible();
  await expect(done).toHaveCSS('opacity', '0.5');
  expect(reminders.calls.filter((c) => c.kind === 'GET ').length).toBe(1);
});

test('a list that left before a change and lands after it doesn\'t undo the change', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.delay['GET '] = 4000;
  await open(page, reminders); // the month's list is on its way, and slow
  await startNew(page, 'Tuesday, October 20', 'Dentist');
  await button(page, 'Save').click();
  await expect(page.getByText('New reminder')).toHaveCount(0);
  await expect(cell(page, 'Tuesday, October 20')).toHaveAccessibleName(/, 1 reminder$/);

  // The first list (without Dentist) lands, is set aside and asked again; Dentist stays throughout.
  await expect.poll(() => reminders.calls.filter((c) => c.kind === 'GET ').length, { timeout: 10_000 }).toBe(2);
  await expect(cell(page, 'Tuesday, October 20')).toHaveAccessibleName(/, 1 reminder$/);
  await page.waitForTimeout(4500); // the second list lands
  await expect(cell(page, 'Tuesday, October 20')).toHaveAccessibleName(/, 1 reminder$/);
  await expect(page.getByLabel('Dentist, 19:00')).toBeVisible();
});

test('the months move while a save is on its way: the new months still get its days', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.delay['POST '] = 2500; // saved on the server only when it answers
  await open(page, reminders);
  await startNew(page, 'Tuesday, October 20', 'Vitamins');
  await button(page, 'Daily').click();
  await button(page, 'Save').click();
  await button(page, 'Close').click(); // the sheet closes; the save goes on
  await page.getByLabel('Next month').click();
  await expect(page.getByText('November 2026')).toBeVisible();

  // Loaded first: Aug–Dec, so the answer's days end on 31 Dec. Now Sep–Jan: January needs a new
  // list, asked once the save has landed.
  const jan15 = cell(page, 'Friday, January 15');
  await expect(jan15).toHaveAccessibleName(/, 1 reminder$/, { timeout: 10_000 });
  await expect(cell(page, 'Sunday, November 15')).toHaveAccessibleName(/, 1 reminder$/);
});

// When the save lands, its day is selected only if its month is the one on screen then.
test('the months move while a save is on its way: the day card stays on the month in view', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.delay['POST '] = 2500;
  await open(page, reminders);
  await startNew(page, 'Tuesday, October 20', 'Vitamins');
  await button(page, 'Save').click();
  await button(page, 'Close').click();
  await page.getByLabel('Next month').click();
  await expect(page.getByText('November 2026')).toBeVisible();
  await expect(page.locator('[aria-selected="true"]')).toHaveAccessibleName(/^Sunday, November 1\b/);
  await expect.poll(() => reminders.calls.filter((c) => c.kind === 'POST ').length).toBe(1);
  await page.waitForTimeout(3000); // the save lands
  await expect(page.getByText('November 2026')).toBeVisible();
  await expect(page.locator('[aria-selected="true"]')).toHaveAccessibleName(/^Sunday, November 1\b/, { timeout: 2000 });
});

test('retrying "Only this day" after a failed skip updates the copy it made, not a new one', async ({ page }) => {
  const reminders = fakeReminders();
  reminders.reminders = [
    { id: 'r1', title: 'Vitamins', hour: 20, minute: 0, repeat: 'daily', calendar: 'gregorian', start: '2026-10-01', skipped: [] },
  ];
  await open(page, reminders);
  await cell(page, 'Tuesday, October 20').click();
  await page.getByLabel('Vitamins, 20:00').click();
  await title(page).fill('Vitamin D');
  await button(page, 'Save').click();
  reminders.fail['POST /:id/skip'] = { status: 503, message: 'unavailable' };
  await button(page, 'Only Tue 20 Oct').click();
  await expect(page.getByRole('dialog').getByText('unavailable')).toBeVisible();

  await title(page).fill('Vitamin D3');
  await button(page, 'Save').click();
  await button(page, 'Only Tue 20 Oct').click();
  await expect(page.getByText('Edit reminder')).toHaveCount(0);

  expect(reminders.calls.filter((c) => c.kind === 'POST ')).toHaveLength(1);
  const copies = reminders.reminders.filter((r) => r.repeat === 'once');
  expect(copies.map((r) => r.title)).toEqual(['Vitamin D3']);
  await expect(page.getByLabel('Vitamin D3, 20:00')).toBeVisible();
  await expect(page.getByLabel('Vitamins, 20:00')).toHaveCount(0);
  await expect(cell(page, 'Tuesday, October 20')).toHaveAccessibleName(/, 1 reminder$/);
});

test.describe('a phone set to New York', () => {
  test.use({ timezoneId: 'America/New_York' });

  test("today is Israel's date: at 19:00 in New York it's already the next day", async ({ page }) => {
    // Sat 17 Oct 2026, 23:00 UTC: 19:00 on the 17th in New York, 02:00 on the 18th in Israel.
    await open(page, fakeReminders(), new Date('2026-10-17T23:00:00Z'));
    await expect(page.getByLabel(/, today,/)).toHaveAccessibleName(/^Sunday, October 18,/);
    await expect(page.locator('[aria-selected="true"]')).toHaveAccessibleName(/^Sunday, October 18,/);
  });
});
