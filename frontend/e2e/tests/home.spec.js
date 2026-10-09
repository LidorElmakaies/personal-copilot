const { test, expect } = require('@playwright/test');

// RN-web animations run in JS, so Playwright's `animations: 'disabled'` doesn't stop them.
const settle = (page) => page.waitForTimeout(800);

test('home shows the live clock and both dates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeVisible();
  await expect(page.getByText(/^\d{1,2}\.\d{1,2}\.\d{4}$/)).toBeVisible();
  await settle(page);
  await page.screenshot({ path: 'screenshots/home.png', fullPage: true });
});

test('account tab asks to log in while signed out', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Account', { exact: true }).click();
  await expect(page.getByText('Log in to view Account?')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: 'screenshots/account-signed-out.png' });
});

// The in-app update prompt is Android-only: the web build never asks the APK registry and shows no chip.
test('web home has no update chip and never fetches latest.json', async ({ page }) => {
  const asked = [];
  page.on('request', (r) => r.url().includes('latest.json') && asked.push(r.url()));
  await page.goto('/');
  await expect(page.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByRole('button', { name: /^Update to / })).toHaveCount(0);
  expect(asked).toEqual([]);
});
