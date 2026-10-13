const { test, expect } = require('@playwright/test');

// The Calendar tab's month grid. Gateway's /calendar/month is mocked with a made-up month so
// the dots and dates are known; the last test uses the real backend.

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const settle = (page) => page.waitForTimeout(800);

// A GET /calendar/month answer: every day of the month, 1 Tishrei on the 12th of September 2026
// (Elul before it), and `events` by day of the month.
function monthBody(year, month, events = {}) {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const tishrei = n >= 12;
    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(n).padStart(2, '0')}`,
      hebrew: {
        day: tishrei ? n - 11 : n + 18,
        dayHe: `ה${n}`,
        month: tishrei ? { en: 'Tishrei', he: 'תשרי' } : { en: 'Elul', he: 'אלול' },
        year: tishrei ? 5787 : 5786,
        yearHe: tishrei ? 'תשפ״ז' : 'תשפ״ו',
      },
      events: events[n] ?? [],
      parasha: null,
      times: [],
    };
  });
  return { year, month, days };
}

const SEPTEMBER = monthBody(2026, 9, {
  12: [{ kind: 'yomTov', name: { en: 'Rosh Hashana 5787', he: 'ראש השנה' } }],
  14: [{ kind: 'fast', name: { en: 'Tzom Gedaliah', he: 'צום גדליה' } }],
});

// Freezes the clock and answers /calendar/month per (year, month); returns the requested URLs.
async function mockMonths(page, at, bodies, { delayMs = {} } = {}) {
  const requests = [];
  await page.clock.setFixedTime(new Date(at));
  await page.route('**/calendar/month?*', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const key = `${url.searchParams.get('year')}-${url.searchParams.get('month')}`;
    if (delayMs[key]) await new Promise((r) => setTimeout(r, delayMs[key]));
    const [year, month] = key.split('-').map(Number);
    return route.fulfill({ json: bodies[key] ?? monthBody(year, month) });
  });
  return requests;
}

const day = (page, label) => page.getByLabel(label, { exact: false });

test.describe('with location allowed', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

  test('shows the month with both dates, holidays, fasts and today', async ({ page }) => {
    const requests = await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': SEPTEMBER });
    await page.goto('/calendar');

    await expect(page.getByText('September 2026')).toBeVisible();
    await expect(page.getByText('אלול – תשרי תשפ״ז')).toBeVisible();
    await expect(day(page, 'Saturday, September 12, ה12 תשרי, Rosh Hashana 5787')).toBeVisible();
    await expect(day(page, 'Monday, September 14, ה14 תשרי, Tzom Gedaliah')).toBeVisible();
    await expect(day(page, 'Sunday, September 27, today, ה27 תשרי')).toBeVisible();
    await expect(page.getByLabel(/, today,/)).toHaveCount(1);

    const last = requests.at(-1);
    expect(Object.fromEntries(last.searchParams)).toEqual({
      year: '2026',
      month: '9',
      lat: '32.0853',
      lon: '34.7818',
      tz: 'Asia/Jerusalem',
    });

    await settle(page);
    await page.screenshot({ path: 'screenshots/calendar-month.png', fullPage: true });
  });

  test('the arrows move a month at a time, across the year end', async ({ page }) => {
    const requests = await mockMonths(page, '2026-12-10T08:00:00Z', {});
    await page.goto('/calendar');
    await expect(page.getByText('December 2026')).toBeVisible();

    await page.getByLabel('Next month').click();
    await expect(page.getByText('January 2027')).toBeVisible();
    await expect(day(page, 'Friday, January 1,')).toBeVisible();

    await page.getByLabel('Previous month').click();
    await page.getByLabel('Previous month').click();
    await expect(page.getByText('November 2026')).toBeVisible();

    expect(requests.map((u) => `${u.searchParams.get('year')}-${u.searchParams.get('month')}`))
      .toEqual(['2026-12', '2027-1', '2026-12', '2026-11']);
  });

  test("a slow answer for a month you've left doesn't replace the one shown", async ({ page }) => {
    await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': SEPTEMBER }, {
      delayMs: { '2026-10': 1500 },
    });
    await page.goto('/calendar');
    await expect(day(page, 'Monday, September 14,')).toBeVisible();

    await page.getByLabel('Next month').click(); // October answers late
    await page.getByLabel('Previous month').click();
    await page.waitForTimeout(2000);

    await expect(page.getByText('September 2026')).toBeVisible();
    await expect(day(page, 'Monday, September 14,')).toBeVisible();
  });

  test('dots: cyan for a holiday, red for a fast, red when both; Fri/Sat amber; only today outlined', async ({ page }) => {
    await mockMonths(page, '2026-09-27T08:00:00Z', {
      '2026-9': monthBody(2026, 9, {
        12: [{ kind: 'yomTov', name: { en: 'Rosh Hashana 5787', he: 'ראש השנה' } }],
        14: [{ kind: 'fast', name: { en: 'Tzom Gedaliah', he: 'צום גדליה' } }],
        15: [
          { kind: 'minor', name: { en: 'Some holiday', he: 'חג' } },
          { kind: 'fast', name: { en: 'Some fast', he: 'צום' } },
        ],
      }),
    });
    await page.goto('/calendar');
    await expect(day(page, 'Tuesday, September 15,')).toBeVisible();

    // Each cell: [Gregorian day, Hebrew day, dot].
    const cell = (label) =>
      day(page, label).evaluate((el) => {
        const [greg, , dot] = el.children;
        return {
          dot: getComputedStyle(dot).backgroundColor,
          greg: getComputedStyle(greg).color,
          border: getComputedStyle(el).borderTopColor,
        };
      });
    const holiday = await cell('Saturday, September 12,');
    const fast = await cell('Monday, September 14,');
    const both = await cell('Tuesday, September 15,');
    const plain = await cell('Thursday, September 17,');
    const friday = await cell('Friday, September 18,');
    const saturday = await cell('Saturday, September 19,');
    const today = await cell('Sunday, September 27,');

    const clear = 'rgba(0, 0, 0, 0)';
    expect(plain.dot).toBe(clear);
    expect(holiday.dot).not.toBe(clear);
    expect(fast.dot).not.toBe(clear);
    expect(fast.dot).not.toBe(holiday.dot);
    expect(both.dot).toBe(fast.dot);

    expect(friday.greg).toBe(saturday.greg);
    expect(friday.greg).not.toBe(plain.greg);

    expect(today.border).not.toBe(clear);
    expect(plain.border).toBe(clear);
    expect(friday.border).toBe(clear);
  });

  test('the 1st sits under its weekday: no blanks for a Sunday, six for a Saturday', async ({ page }) => {
    // November 2026 starts on a Sunday, August 2026 on a Saturday.
    await mockMonths(page, '2026-11-10T08:00:00Z', {});
    await page.goto('/calendar');
    await expect(day(page, 'Sunday, November 1,')).toBeVisible();
    const box = async (label) => day(page, label).boundingBox();

    const sun1 = await box('Sunday, November 1,');
    const sat7 = await box('Saturday, November 7,');
    expect(Math.abs(sun1.y - sat7.y)).toBeLessThan(1); // one row, Sunday to Saturday
    expect(sat7.x - sun1.x).toBeCloseTo(6 * sun1.width, -1);

    for (let i = 0; i < 3; i++) await page.getByLabel('Previous month').click();
    await expect(page.getByText('August 2026')).toBeVisible();
    const sat1 = await box('Saturday, August 1,');
    const sun2 = await box('Sunday, August 2,');
    expect(sun2.y).toBeGreaterThan(sat1.y); // the 2nd starts the next row
    expect(sat1.x - sun2.x).toBeCloseTo(6 * sun2.width, -1);
    expect(sun2.x).toBeCloseTo(sun1.x, 0);
  });

  test("a month that fails to load says so, and Retry fetches it again", async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-27T08:00:00Z'));
    let calls = 0;
    await page.route('**/calendar/month?*', (route) =>
      ++calls === 1
        ? route.fulfill({ status: 502, json: { message: 'calendar_unreachable' } })
        : route.fulfill({ json: SEPTEMBER }),
    );
    await page.goto('/calendar');
    await expect(page.getByText("Couldn't load this month.")).toBeVisible();

    await page.getByText('Retry', { exact: true }).click();
    await expect(day(page, 'Monday, September 14,')).toBeVisible();
    await expect(page.getByText("Couldn't load this month.")).toHaveCount(0);
    expect(calls).toBe(2);
  });

  test('real backend: shows this month with today marked', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByLabel(/, today,/)).toHaveCount(1);
    await expect(page.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/)).toBeVisible();
  });
});

test.describe('with location refused', () => {
  test.use({ permissions: [], timezoneId: 'Asia/Jerusalem' });

  test('explains location is off and offers Retry', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText(/^Location is off\./)).toBeVisible();
    await expect(page.getByText('Retry', { exact: true })).toBeVisible();
  });
});
