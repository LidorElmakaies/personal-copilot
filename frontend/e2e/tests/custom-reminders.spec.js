const { test, expect } = require('@playwright/test');

// Your own reminders on the Calendar tab (mockup 3.6a: P2's + button, X1's edit sheet, "Only this
// day / Every time"). The reminders are the real backend's: one throwaway account for the file, its
// reminders cleared before each test and the account deleted at the end — real time, real repeat
// rules. The months are mocked (plain days, no holidays): the whole suite shares the real Gateway's
// per-IP rate limit, and a page loads five months. In order, so a failure doesn't re-register.

const API = process.env.E2E_API_URL ?? 'http://localhost:8000';
const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const TZ = 'Asia/Jerusalem';
const PASSWORD = 'e2e-password-123';

test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: TZ });
test.describe.configure({ mode: 'serial' });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

// A GET /calendar/month answer with plain days: dates only, no holidays or times.
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

async function mockCalendar(page) {
  await page.route('**/ws/**', (route) => route.abort());
  // Calls this file doesn't test, kept off the real Gateway's per-IP rate limit: a 429 on a change's
  // refetch leaves the grid stale (see custom-reminder-sheet.spec.js).
  await page.route('**/realtime/device', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/users/me', (route) =>
    route.fulfill({ json: { firstName: null, lastName: null, phone: null, location: null }, headers: CORS }),
  );
  await page.route('**/users/me/location', (route) => route.fulfill({ json: {}, headers: CORS }));
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503, headers: CORS }));
  await page.route('**/calendar/month?*', (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: monthBody(Number(url.searchParams.get('year')), Number(url.searchParams.get('month'))),
      headers: CORS,
    });
  });
}

// 'YYYY-MM-DD' of today in Israel, and helpers on such dates.
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const utc = (date) => new Date(`${date}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (date, n) => {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const lastOfMonth = (date) => {
  const d = utc(date);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
};
// The grid cell's label starts "Tuesday, October 20," (see MonthGrid's labelOf).
const cellLabel = (date) =>
  utc(date).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
const cell = (page, date) => page.getByLabel(new RegExp(`^${cellLabel(date)},`));
// "Mon 19 Oct 2026", as the sheet writes it.
const shortDate = (date, withYear) => {
  const d = utc(date);
  const s = `${d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })} ${d.getUTCDate()} ${d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })}`;
  return withYear ? `${s} ${d.getUTCFullYear()}` : s;
};

let account; // { email, accessToken, refreshToken }

async function api(request, method, path, data) {
  const res = await request.fetch(`${API}${path}`, {
    method,
    data,
    headers: account ? { Authorization: `Bearer ${account.accessToken}` } : {},
  });
  expect(res.ok(), `${method} ${path} → ${res.status()}`).toBeTruthy();
  return res.status() === 204 ? null : res.json();
}

test.beforeAll(async ({ request }) => {
  const email = `e2e-reminders-${Date.now()}@example.com`;
  account = null;
  const tokens = await api(request, 'POST', '/auth/register', { email, password: PASSWORD });
  account = { email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
});

// /auth/account is on the strict rate limit (5 a minute): runs close together can hit it, so a 429
// waits the minute out once rather than leave the account behind.
test.afterAll(async ({ request }, testInfo) => {
  if (!account) return;
  testInfo.setTimeout(120_000);
  const { email } = account;
  account = null;
  const remove = () => request.delete(`${API}/auth/account`, { data: { email, currentPassword: PASSWORD } });
  let res = await remove();
  if (res.status() === 429) {
    await new Promise((resolve) => setTimeout(resolve, 61_000));
    res = await remove();
  }
  expect(res.ok(), `DELETE /auth/account → ${res.status()}`).toBeTruthy();
});

async function clearReminders(request) {
  const from = plusDays(todayIso(), -40);
  const list = await api(request, 'GET', `/reminders/custom?from=${from}&to=${plusDays(from, 399)}`);
  for (const r of list) await api(request, 'DELETE', `/reminders/custom/${r.id}`);
}

// redux-persist on web: AsyncStorage → localStorage, each field JSON-stringified on its own.
async function signIn(page) {
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(account.accessToken),
    refreshToken: JSON.stringify(account.refreshToken),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('e2e-signed-in')) {
      sessionStorage.setItem('e2e-signed-in', '1');
      localStorage.setItem('persist:auth', value);
    }
  }, persisted);
}

async function openCalendar(page) {
  await mockCalendar(page);
  await page.goto('/calendar');
  await expect(page.getByLabel(/, today,/)).toHaveCount(1);
}

// Opens the + sheet on `date` (this month), types a title and sets the time.
async function startNew(page, date, title, { hour = 19, minute = 0 } = {}) {
  await cell(page, date).click();
  await page.getByLabel('Add reminder').click();
  await expect(page.getByText('New reminder')).toBeVisible();
  await page.getByPlaceholder('e.g. Call Grandma').fill(title);
  for (let h = 19; h < hour; h++) await page.getByLabel('More hours').click();
  for (let h = 19; h > hour; h--) await page.getByLabel('Fewer hours').click();
  for (let m = 0; m < minute; m += 5) await page.getByLabel('More min').click();
}

// The sheet's GradientButtons: no button role (see reminders.spec.js), so found by their exact text,
// in the sheet — the Account tab, mounted alongside, has a "Delete" of its own.
const button = (page, text) => page.getByRole('dialog').getByText(text, { exact: true });
const save = (page) => button(page, 'Save').click();
const sheetGone = (page) => expect(page.getByText(/^(New|Edit) reminder$/)).toHaveCount(0);
// Late in the day, so a reminder made today is still ahead.
const LATE = { hour: 23, minute: 55 };

test.describe('signed in', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearReminders(request);
    await signIn(page);
  });

  test('a once-reminder: the sheet shows its date in both calendars, then its day lists it', async ({ page }) => {
    const day = lastOfMonth(todayIso());
    await openCalendar(page);
    await startNew(page, day, 'Dentist', LATE);

    const next = page.getByLabel('Next dates');
    await expect(next).toContainText(`Once, on ${shortDate(day, true)}, 23:55`);
    await expect(next).toContainText(shortDate(day, true));
    await page.screenshot({ path: 'screenshots/custom-reminder-new.png' });
    await save(page);
    await sheetGone(page);

    await expect(cell(page, day)).toHaveAccessibleName(/, 1 reminder$/);
    await expect(page.getByLabel('Dentist, 23:55')).toBeVisible();
    await expect(page.getByText(`Once · ${shortDate(day)}`)).toBeVisible();
  });

  test('a daily one counts on every day from its start; "Only this day" edits just that day', async ({ page, request }) => {
    const today = todayIso();
    const last = lastOfMonth(today);
    await openCalendar(page);
    await startNew(page, today, 'Take vitamins', LATE);
    await page.getByRole('button', { name: 'Daily' }).click();
    await expect(page.getByLabel('Next dates')).toContainText(shortDate(plusDays(today, 1), true));
    await save(page);
    await sheetGone(page);

    await expect(cell(page, today)).toHaveAccessibleName(/, 1 reminder$/);
    await expect(cell(page, last)).toHaveAccessibleName(/, 1 reminder$/);

    // Today only: renamed, and a once-reminder of its own; the series skips today.
    await cell(page, today).click();
    await page.getByLabel('Take vitamins, 23:55').click();
    await expect(page.getByText('Edit reminder')).toBeVisible();
    await page.getByPlaceholder('e.g. Call Grandma').fill('Vitamin D');
    await save(page);
    await expect(page.getByText('Change "Take vitamins"')).toBeVisible();
    await page.screenshot({ path: 'screenshots/custom-reminder-series.png' });
    await button(page, `Only ${shortDate(today)}`).click();
    await sheetGone(page);

    await expect(page.getByLabel('Vitamin D, 23:55')).toBeVisible();
    await expect(page.getByLabel('Take vitamins, 23:55')).toHaveCount(0);
    await expect(cell(page, today)).toHaveAccessibleName(/, 1 reminder$/);
    const list = await api(request, 'GET', `/reminders/custom?from=${today}&to=${today}`);
    expect(list.map((r) => [r.title, r.repeat, r.dates])).toEqual(
      expect.arrayContaining([
        ['Take vitamins', 'daily', []],
        ['Vitamin D', 'once', [today]],
      ]),
    );
  });

  test('"Every time" changes the whole series', async ({ page }) => {
    const today = todayIso();
    const last = lastOfMonth(today);
    await openCalendar(page);
    await startNew(page, today, 'Walk the dog', LATE);
    await page.getByRole('button', { name: 'Daily' }).click();
    await save(page);
    await sheetGone(page);

    await cell(page, last).click();
    await page.getByLabel('Walk the dog, 23:55').click();
    await page.getByLabel('Fewer hours').click();
    await save(page);
    await button(page, 'Every time').click();
    await sheetGone(page);

    await expect(page.getByLabel('Walk the dog, 22:55')).toBeVisible();
    await cell(page, today).click();
    await expect(page.getByLabel('Walk the dog, 22:55')).toBeVisible();
  });

  test('delete: "Only this day" leaves that day out, "Every time" removes it everywhere', async ({ page }) => {
    const today = todayIso();
    const last = lastOfMonth(today);
    test.skip(today === last, 'needs two days left in the month');
    await openCalendar(page);
    await startNew(page, today, 'Stretch', LATE);
    await page.getByRole('button', { name: 'Daily' }).click();
    await save(page);
    await sheetGone(page);

    await cell(page, today).click();
    await page.getByLabel('Stretch, 23:55').click();
    await button(page, 'Delete').click();
    await expect(page.getByText('Delete "Stretch"')).toBeVisible();
    await button(page, `Only ${shortDate(today)}`).click();
    await sheetGone(page);
    await expect(cell(page, today)).not.toHaveAccessibleName(/reminder/);
    await expect(cell(page, last)).toHaveAccessibleName(/, 1 reminder$/);

    await cell(page, last).click();
    await page.getByLabel('Stretch, 23:55').click();
    await button(page, 'Delete').click();
    await button(page, 'Every time').click();
    await sheetGone(page);
    await expect(cell(page, last)).not.toHaveAccessibleName(/reminder/);
  });

  test('a once-reminder asks once before it is deleted', async ({ page }) => {
    const day = lastOfMonth(todayIso());
    await openCalendar(page);
    await startNew(page, day, 'Call Grandma', LATE);
    await save(page);
    await sheetGone(page);

    await page.getByLabel('Call Grandma, 23:55').click();
    await button(page, 'Delete').click();
    await expect(page.getByText('Delete "Call Grandma"?')).toBeVisible();
    await button(page, 'Keep').click();
    await button(page, 'Delete').click();
    await button(page, 'Delete').click();
    await sheetGone(page);
    await expect(page.getByLabel('Call Grandma, 23:55')).toHaveCount(0);
  });

  test('a Hebrew yearly one falls on its Hebrew date next year, not the same Gregorian day', async ({ page, request }) => {
    const today = todayIso();
    await openCalendar(page);
    await startNew(page, today, 'Noa birthday', LATE);
    await page.getByRole('button', { name: 'Yearly' }).click();
    await page.getByRole('button', { name: /^Hebrew · / }).click();
    await expect(page.getByLabel('Next dates')).toContainText('Every year on');
    await expect(page.getByLabel('Next dates')).toContainText('Next');
    await page.screenshot({ path: 'screenshots/custom-reminder-hebrew-yearly.png' });
    await save(page);
    await sheetGone(page);

    // Next year's day, from the server, is a different Gregorian date with the same Hebrew one.
    const from = plusDays(today, 300);
    const [r] = await api(request, 'GET', `/reminders/custom?from=${from}&to=${plusDays(from, 120)}`);
    expect(r.dates).toHaveLength(1);
    const nextYear = r.dates[0];
    expect(nextYear.slice(5)).not.toBe(today.slice(5));

    // The same Hebrew day and month as today (from the real calendar).
    const hebrewOf = async (date) => {
      const [y, m] = date.split('-').map(Number);
      const res = await request.get(`${API}/calendar/month?year=${y}&month=${m}&lat=${TEL_AVIV.latitude}&lon=${TEL_AVIV.longitude}`);
      const { hebrew } = (await res.json()).days.find((d) => d.date === date);
      return `${hebrew.day} ${hebrew.month.en}`;
    };
    expect(await hebrewOf(nextYear)).toBe(await hebrewOf(today));

    // And shown there on the grid.
    const months =
      (utc(nextYear).getUTCFullYear() - utc(today).getUTCFullYear()) * 12 +
      utc(nextYear).getUTCMonth() -
      utc(today).getUTCMonth();
    for (let i = 0; i < months; i++) await page.getByLabel('Next month').click();
    await expect(cell(page, nextYear)).toHaveAccessibleName(/, 1 reminder$/);
  });
  test('monthly: a Gregorian 31st falls on a shorter month\'s last day; a Hebrew one keeps its Hebrew day', async ({ page, request }) => {
    const today = todayIso();
    await openCalendar(page);

    // A 31st in this month or the next (two months running never both have 30 days or fewer).
    let first = lastOfMonth(today);
    if (!first.endsWith('-31')) {
      await page.getByLabel('Next month').click();
      first = lastOfMonth(plusDays(first, 1));
    }
    await startNew(page, first, 'Pay rent', LATE);
    await page.getByRole('button', { name: 'Monthly' }).click();
    await expect(page.getByRole('button', { name: 'Gregorian · the 31st' })).toBeVisible();
    await expect(page.getByText('Months with fewer days: on the last day.')).toBeVisible();
    // The next three: the 31st, then each following month's 31st or last day.
    const expected = [first];
    while (expected.length < 3) expected.push(lastOfMonth(plusDays(expected.at(-1), 1)));
    for (const date of expected) await expect(page.getByLabel('Next dates')).toContainText(shortDate(date, true));
    await save(page);
    await sheetGone(page);
    await expect(page.getByText('Monthly · the 31st')).toBeVisible();
    await page.getByLabel('Next month').click();
    await expect(cell(page, expected[1])).toHaveAccessibleName(/, 1 reminder$/);

    // Hebrew monthly from today: next Hebrew month's same day, a different Gregorian day.
    await page.getByLabel('Go to today').click();
    await startNew(page, today, 'Rosh Chodesh call', LATE);
    await page.getByRole('button', { name: 'Monthly' }).click();
    await page.getByRole('button', { name: /^Hebrew · the / }).click();
    await save(page);
    await sheetGone(page);
    await expect(page.getByText(/^Monthly · the \d+(st|nd|rd|th) \(Hebrew\)$/)).toBeVisible();

    const hebrewOf = async (date) => {
      const [y, m] = date.split('-').map(Number);
      const res = await request.get(`${API}/calendar/month?year=${y}&month=${m}&lat=${TEL_AVIV.latitude}&lon=${TEL_AVIV.longitude}`);
      return (await res.json()).days.find((d) => d.date === date).hebrew;
    };
    const todayHebrew = await hebrewOf(today);
    test.skip(todayHebrew.day === 30, 'a 30th moves to the 29th in a short Hebrew month');
    const list = await api(request, 'GET', `/reminders/custom?from=${plusDays(today, 1)}&to=${plusDays(today, 32)}`);
    const { dates } = list.find((r) => r.title === 'Rosh Chodesh call');
    expect(dates).toHaveLength(1);
    const nextHebrew = await hebrewOf(dates[0]);
    expect(nextHebrew.day).toBe(todayHebrew.day);
    expect(nextHebrew.month.en).not.toBe(todayHebrew.month.en);
  });
});

test('signed out: + asks to log in', async ({ page }) => {
  await mockCalendar(page);
  await page.goto('/calendar');
  await page.getByLabel('Add reminder').click();
  await expect(page.getByText('Log in to add reminders?')).toBeVisible();
  await button(page, 'No').click();
  await expect(page.getByText('Log in to add reminders?')).toHaveCount(0);
});
