const { test, expect } = require('@playwright/test');

// Installable web app: the page links a manifest with what Android Chrome needs to offer
// "Install app" — names, standalone display, start URL and scope, and 192/512 px icons
// (one maskable) that are really served as PNGs.

test('the page links the web app manifest and sets the browser-bar colors', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
});

test('the manifest has what Android needs to install the app, and every icon is served', async ({
  request,
}) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toBe('application/manifest+json');
  const manifest = await res.json();

  expect(manifest).toMatchObject({
    name: 'Personal Copilot',
    short_name: expect.any(String),
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
    theme_color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
  });
  const sizes = manifest.icons.map((i) => `${i.sizes} ${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']));

  for (const icon of manifest.icons) {
    const png = await request.get(icon.src);
    expect(png.ok(), icon.src).toBe(true);
    expect(png.headers()['content-type'], icon.src).toBe('image/png');
  }
});
