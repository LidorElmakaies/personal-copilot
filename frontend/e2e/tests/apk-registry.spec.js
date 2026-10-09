const { test, expect } = require('@playwright/test');

// The APK registry Caddy serves at /apk/ (`node devops/android/apk.js publish` writes it). Read-only
// against whatever is published; skipped where nothing is (an empty registry, the cloud deployment).
// The publisher's own logic is tested by `node --test devops/android/apk.test.js`.

test.describe('APK registry', () => {
  let releases;
  let latest;

  test.beforeEach(async ({ request }) => {
    const res = await request.get('/apk/releases.json');
    test.skip(res.status() === 404, 'no APK published here');
    expect(res.ok()).toBe(true);
    releases = await res.json();
    const l = await request.get('/apk/latest.json');
    latest = l.status() === 404 ? null : await l.json();
  });

  test('serves the files with the right headers', async ({ request }) => {
    const redirect = await request.get('/apk', { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers().location).toBe('/apk/');

    const page = await request.get('/apk/');
    expect(page.headers()['content-type']).toContain('text/html');
    expect(page.headers()['cache-control']).toBe('no-cache');

    // No SPA fallback under /apk/: a missing file is a 404, not the app's index.html.
    expect((await request.get('/apk/personal-copilot-0.0.0.apk')).status()).toBe(404);

    if (latest) {
      expect((await request.get('/apk/latest.json')).headers()['cache-control']).toBe('no-cache');
      expect(latest.url).toMatch(/^\/apk\/personal-copilot-[\w.-]+\.apk$/);
    }
    for (const r of releases) {
      const apk = await request.head(`/apk/${r.file}`);
      expect(apk.status(), r.file).toBe(200);
      expect(apk.headers()['content-type']).toBe('application/vnd.android.package-archive');
      expect(Number(apk.headers()['content-length'])).toBe(r.size);
    }
  });

  test('the page lists every release, newest first, with one Latest', async ({ page }) => {
    await page.goto('/apk');
    await expect(page).toHaveURL(/\/apk\/$/);
    await expect(page.getByRole('heading', { name: 'Personal Copilot' })).toBeVisible();

    const items = page.locator('.timeline > li');
    await expect(items.locator('.relTop strong')).toHaveText(releases.map((r) => r.version));
    await expect(page.locator('.badge.latest')).toHaveCount(latest ? 1 : 0);
    if (latest) {
      const now = page.locator('.rel.now');
      await expect(now.locator('strong')).toHaveText(latest.version);
      await expect(now.locator('.badge.latest')).toHaveText(/latest/i);
      const href = await now.getByRole('link', { name: 'Download' }).evaluate((a) => a.href);
      expect(new URL(href).pathname).toBe(latest.url);
    }
    for (const [i, r] of releases.entries()) {
      await expect(items.nth(i).locator('.notes > li')).toHaveText(r.notes);
    }
    await page.screenshot({ path: 'screenshots/apk-registry.png', fullPage: true });
  });
});
