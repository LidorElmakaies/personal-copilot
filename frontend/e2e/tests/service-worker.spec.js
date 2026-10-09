const { test, expect } = require('@playwright/test');

// The Web Push service worker (public/sw.js): a push delivered over CDP — as the
// browser's push service would — shows a notification built from the payload.

// The default headless shell reports notifications as denied even when granted; full Chromium
// doesn't. A channel can only be set per file, hence this file of its own.
test.use({ permissions: ['notifications'], channel: 'chromium' });

test('a push shows the notification from its payload', async ({ page, context }) => {
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/calendar/shabbat?*', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(new URL('/', page.url()).href);

  const cdp = await context.newCDPSession(page);
  const registered = new Promise((resolve) =>
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const found = registrations.find((r) => r.scopeURL === scope && !r.isDeleted);
      if (found) resolve(found.registrationId);
    }),
  );
  await cdp.send('ServiceWorker.enable');
  const registrationId = await registered;

  const payload = {
    notificationId: 'e2e-notification',
    title: 'Shabbat candle lighting',
    body: 'Candle lighting is at 17:34 (in 1 h 30 min).',
    url: '/',
  };
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: new URL(page.url()).origin,
    registrationId,
    data: JSON.stringify(payload),
  });

  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({
          title: n.title,
          body: n.body,
          tag: n.tag,
          data: n.data,
        })),
      ),
    )
    .toEqual([{ title: payload.title, body: payload.body, tag: payload.notificationId, data: { url: '/' } }]);
});
