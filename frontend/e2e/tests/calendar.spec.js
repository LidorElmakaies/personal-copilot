const { test, expect } = require('@playwright/test');

// The Calendar tab's month grid. Gateway's /calendar/month is mocked with a made-up month so
// the dots and dates are known; the last test uses the real backend.

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const settle = (page) => page.waitForTimeout(800);

// A GET /calendar/month answer: every day of the month, 1 Tishrei on the 12th of September 2026
// (Elul before it), `events` by day of the month, and `extra` fields (times, parasha) by day.
function monthBody(year, month, events = {}, extra = {}) {
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
      ...extra[n],
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

    // The month shown is asked for first (then the ones around it, preloaded).
    expect(Object.fromEntries(requests[0].searchParams)).toEqual({
      year: '2026',
      month: '9',
      lat: '32.0853',
      lon: '34.7818',
    });

    await settle(page);
    await page.screenshot({ path: 'screenshots/calendar-month.png', fullPage: true });
  });

  test('the arrows slide a month at a time, across the year end; two quick taps add up', async ({ page }) => {
    const requests = await mockMonths(page, '2026-12-10T08:00:00Z', {});
    await page.goto('/calendar');
    await expect(page.getByText('December 2026')).toBeVisible();

    await page.getByLabel('Next month').click();
    await expect(page.getByText('January 2027')).toBeVisible();
    await expect(day(page, 'Friday, January 1,')).toBeVisible();

    await page.getByLabel('Previous month').click();
    await page.getByLabel('Previous month').click();
    await expect(page.getByText('November 2026')).toBeVisible();
    await expect(day(page, 'Sunday, November 1,')).toBeVisible();

    // Each month is fetched once, however often it's passed or shown.
    const asked = requests.map((u) => `${u.searchParams.get('year')}-${u.searchParams.get('month')}`);
    expect(asked[0]).toBe('2026-12');
    expect(new Set(asked).size).toBe(asked.length);
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
    await expect(day(page, 'Saturday, August 1,')).toBeInViewport({ ratio: 1 }); // the slide has landed
    const sat1 = await box('Saturday, August 1,');
    const sun2 = await box('Sunday, August 2,');
    expect(sun2.y).toBeGreaterThan(sat1.y); // the 2nd starts the next row
    expect(sat1.x - sun2.x).toBeCloseTo(6 * sun2.width, -1);
    expect(sun2.x).toBeCloseTo(sun1.x, 0);
  });

  test("a month that fails to load says so, and Retry fetches it again", async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-27T08:00:00Z'));
    let calls = 0; // September's (the neighbours preload fine)
    await page.route('**/calendar/month?*', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('month') !== '9') {
        return route.fulfill({ json: monthBody(2026, Number(url.searchParams.get('month'))) });
      }
      return ++calls === 1
        ? route.fulfill({ status: 502, json: { message: 'calendar_unreachable' } })
        : route.fulfill({ json: SEPTEMBER });
    });
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

test.describe('swiping months', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

  const title = (page) => page.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/);
  const keys = (requests) => requests.map((u) => `${u.searchParams.get('year')}-${u.searchParams.get('month')}`);
  // Drags across the month on screen (`shown`, e.g. 'September'), `months` grid-widths sideways
  // (negative: to the left = later months). The neighbouring months are in the page too, off to
  // the side, so the grid is measured from a day of the shown month.
  async function drag(page, shown, months, { steps = 30, pauseMs = 16 } = {}) {
    const cell = await day(page, `, ${shown} 16,`).boundingBox();
    const width = cell.width * 7;
    const y = cell.y + cell.height / 2;
    const center = page.viewportSize().width / 2;
    let x = center - Math.sign(months) * width * 0.48;
    // Until the swipe area has taken the month's measured height, the month is clipped and a
    // finger there would miss it — wait until what's under the finger is the shown month.
    await page.waitForFunction(
      ({ x, y, shown }) => document.elementFromPoint(x, y)?.closest(`[aria-label*="${shown} "]`),
      { x, y, shown },
    );
    // A finger, not a mouse: the project is a touch phone, and that's what the phone sends.
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [{ x, y, id: 1 }]);
    for (let i = 1; i <= steps; i++) {
      x += (months * width) / steps;
      await touch('touchMove', [{ x, y, id: 1 }]);
      if (pauseMs) await page.waitForTimeout(pauseMs);
    }
    await page.waitForTimeout(150);
    await touch('touchEnd', []);
    await cdp.detach();
    await page.waitForTimeout(500);
  }

  test('a swipe left/right moves a month; a short drag springs back', async ({ page }) => {
    const requests = await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': SEPTEMBER });
    await page.goto('/calendar');
    await expect(day(page, 'Monday, September 14,')).toBeVisible();

    await drag(page, 'September', -0.6);
    await expect(title(page)).toHaveText('October 2026');
    await expect(day(page, 'Thursday, October 1,')).toBeVisible();

    await drag(page, 'October', 0.6);
    await expect(title(page)).toHaveText('September 2026');

    await drag(page, 'September', -0.15); // not far enough
    await expect(title(page)).toHaveText('September 2026');
    expect(new Set(keys(requests)).size).toBe(keys(requests).length); // nothing fetched twice
  });

  test('one held drag runs through several months', async ({ page }) => {
    // A phone screen is about one month wide, so this needs a wide window (a mouse on desktop).
    await page.setViewportSize({ width: 1400, height: 900 });
    const requests = await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': SEPTEMBER });
    await page.goto('/calendar');
    await expect(day(page, 'Monday, September 14,')).toBeVisible();

    // Two months in one drag: through October and most of November, then let go.
    await drag(page, 'September', -1.9, { steps: 60 });
    await expect(title(page)).toHaveText('November 2026');
    await expect(day(page, 'Sunday, November 1,')).toBeVisible();
    expect(keys(requests)).toContain('2027-1'); // two past November, preloaded on landing

    await drag(page, 'November', 1.9, { steps: 60 }); // and back the same way
    await expect(title(page)).toHaveText('September 2026');
  });

  test('the incoming month shows its numbers first, then its Hebrew dates when loaded', async ({ page }) => {
    await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': SEPTEMBER }, { delayMs: { '2026-10': 1200 } });
    await page.goto('/calendar');
    await expect(day(page, 'Monday, September 14,')).toBeVisible();
    await page.getByLabel('Next month').click();
    await expect(page.getByLabel('Thursday, October 1', { exact: true })).toBeVisible(); // no Hebrew date yet
    await expect(day(page, 'Thursday, October 1, ה1')).toBeVisible({ timeout: 4000 });
  });
});

test.describe('preloading and Today', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });
  const keysOf = (requests) => requests.map((u) => `${u.searchParams.get('year')}-${u.searchParams.get('month')}`);

  test('the month shown first, then two either side; a swipe lands on a month already there', async ({ page }) => {
    const requests = await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': SEPTEMBER });
    await page.goto('/calendar');
    await expect(day(page, 'Monday, September 14,')).toBeVisible();
    await expect.poll(() => keysOf(requests).length).toBe(5);
    expect(keysOf(requests)).toEqual(['2026-9', '2026-10', '2026-8', '2026-11', '2026-7']);
    // October is already in the page, Hebrew dates and all, before going there.
    await expect(day(page, 'Thursday, October 1, ה1')).toBeAttached();

    await page.getByLabel('Next month').click();
    await expect(day(page, 'Thursday, October 1, ה1')).toBeVisible({ timeout: 300 });
    await expect.poll(() => keysOf(requests)).toContain('2026-12'); // the next one out
    expect(keysOf(requests).filter((k) => k === '2026-10')).toHaveLength(1);
  });

  test('a preloaded month appears complete — its Hebrew dates and dots don\'t fade in', async ({ page }) => {
    await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': SEPTEMBER });
    await page.goto('/calendar');
    await expect(day(page, 'Monday, September 14,')).toBeVisible();
    await page.waitForTimeout(1000); // the preload is in

    // Each move brings a new month into reach; right after it, those already loaded are fully drawn.
    const opacityOf = (label) =>
      day(page, label).evaluate((el) => getComputedStyle(el.children[1]).opacity);
    await page.getByLabel('Next month').click();
    await page.waitForTimeout(60);
    expect(await opacityOf('Thursday, October 1, ה1')).toBe('1');
    expect(await opacityOf('Sunday, November 1, ה1')).toBe('1');
    await page.getByLabel('Previous month').click();
    await page.getByLabel('Previous month').click();
    await page.waitForTimeout(60);
    expect(await opacityOf('Saturday, August 1, ה1')).toBe('1');
    expect(await opacityOf('Wednesday, July 1, ה1')).toBe('1');
  });

  test('Today: hidden on today, shown once away, brings back this month and today', async ({ page }) => {
    await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': SEPTEMBER });
    await page.goto('/calendar');
    await expect(day(page, 'Monday, September 14,')).toBeVisible();
    const todayButton = page.getByLabel('Go to today');
    await expect(todayButton).toHaveCount(0);

    await day(page, 'Monday, September 14,').click(); // another day, same month
    await expect(todayButton).toBeVisible();
    await todayButton.click();
    await expect(day(page, 'Sunday, September 27,')).toHaveAttribute('aria-selected', 'true');
    await expect(todayButton).toHaveCount(0);

    for (let i = 0; i < 5; i++) await page.getByLabel('Next month').click(); // far away
    await expect(page.getByText('February 2027')).toBeVisible();
    await todayButton.click();
    await expect(page.getByText('September 2026')).toBeVisible();
    await expect(day(page, 'Sunday, September 27,')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Today', { exact: true })).toHaveCount(1); // the card's chip only
  });
});

test.describe('day card', () => {
  test.use({ geolocation: TEL_AVIV, permissions: ['geolocation'], timezoneId: 'Asia/Jerusalem' });

  const t = (iso) => new Date(iso).toISOString();
  const KIPPUR_MONTH = monthBody(
    2026,
    9,
    {
      14: [{ kind: 'fast', name: { en: 'Tzom Gedaliah', he: 'צום גדליה' } }],
      19: [{ kind: 'holiday', name: { en: 'Shabbat Shuva', he: 'שבת שובה' } }],
      20: [{ kind: 'holiday', name: { en: 'Erev Yom Kippur', he: 'ערב יום כיפור' } }],
      21: [{ kind: 'yomTov', name: { en: 'Yom Kippur', he: 'יום כיפור' } }],
    },
    {
      14: { times: [{ kind: 'fastBegins', at: t('2026-09-14T02:11:00Z') }, { kind: 'fastEnds', at: t('2026-09-14T16:03:00Z') }] },
      19: { parasha: { en: 'Parashat Ha’azinu', he: 'פרשת האזינו' }, times: [{ kind: 'havdalah', at: t('2026-09-19T16:18:00Z') }] },
      20: { times: [{ kind: 'candleLighting', at: t('2026-09-20T15:20:00Z') }, { kind: 'fastBegins', at: t('2026-09-20T15:20:00Z') }] },
      21: { times: [{ kind: 'fastEnds', at: t('2026-09-21T16:15:00Z') }] },
    },
  );
  const card = (page) => page.getByText(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d+ \w+$/);

  test('opens on today; tapping a day shows it and fills its cell', async ({ page }) => {
    await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': KIPPUR_MONTH });
    await page.goto('/calendar');
    await expect(card(page)).toHaveText('Sunday 27 September');
    await expect(page.getByText('Today', { exact: true })).toBeVisible();
    await expect(page.getByText('No candle lighting or fast times')).toBeVisible();

    const plain = day(page, 'Thursday, September 17,');
    const bg = () => plain.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg()).toBe('rgba(0, 0, 0, 0)');
    await plain.click();
    await expect(card(page)).toHaveText('Thursday 17 September');
    await expect(page.getByText('Today', { exact: true })).toHaveCount(1); // the Today button, not the card's chip
    expect(await bg()).not.toBe('rgba(0, 0, 0, 0)');
    await expect(plain).toHaveAttribute('aria-selected', 'true');
  });

  test('names, parasha and times: a fast, Shabbat, and Yom Kippur as a fast', async ({ page }) => {
    await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': KIPPUR_MONTH });
    await page.goto('/calendar');

    await day(page, 'Monday, September 14,').click();
    await expect(page.getByText('Tzom Gedaliah', { exact: true })).toBeVisible();
    await expect(page.getByText('Fast', { exact: true })).toBeVisible();
    await expect(page.getByText('Fast begins')).toBeVisible();
    await expect(page.getByText('05:11')).toBeVisible();
    await expect(page.getByText('19:03')).toBeVisible();

    await day(page, 'Saturday, September 19,').click();
    await expect(page.getByText('Parashat Ha’azinu ·', { exact: false })).toBeVisible();
    await expect(page.getByText('Havdalah', { exact: true })).toBeVisible();

    await day(page, 'Sunday, September 20,').click();
    await expect(page.getByText('Candle lighting · fast begins')).toBeVisible();
    await expect(page.getByText('18:20')).toHaveCount(1); // one row, not two
    await day(page, 'Monday, September 21,').click();
    await expect(page.getByText('Yom Tov', { exact: true })).toBeVisible();
    await expect(page.getByText('Fast ends')).toBeVisible();

    await day(page, 'Friday, September 4,').click(); // no events: titled by the weekday
    await expect(page.getByText('Friday', { exact: true })).toBeVisible();

    await day(page, 'Sunday, September 20,').click();
    await settle(page);
    await page.screenshot({ path: 'screenshots/calendar-day-card.png', fullPage: true });
  });

  test('another month opens on its 1st; back to this month opens on today', async ({ page }) => {
    await mockMonths(page, '2026-09-27T08:00:00Z', { '2026-9': KIPPUR_MONTH });
    await page.goto('/calendar');
    await expect(card(page)).toHaveText('Sunday 27 September');
    await page.getByLabel('Next month').click();
    await expect(card(page)).toHaveText('Thursday 1 October');
    await page.getByLabel('Previous month').click();
    await expect(card(page)).toHaveText('Sunday 27 September');
  });

  test('real backend: the card shows today', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText('Today', { exact: true })).toBeVisible();
  });
});

test.describe('with location refused', () => {
  test.use({ permissions: [], timezoneId: 'Asia/Jerusalem' });

  test('explains location is off and offers Retry', async ({ page }) => {
    await page.goto('/calendar');
    // Home sits mounted beside Calendar (the tab swipe) and says the same about Shabbat times.
    await expect(page.getByText(/^Location is off\. .* see the calendar/)).toBeVisible();
    await expect(page.getByText('Retry', { exact: true }).last()).toBeInViewport();
  });
});
