// Ad-hoc capture: node scripts/screenshot.js [path] [name]  →  screenshots/<name>.png
const { chromium, devices } = require('@playwright/test');

(async () => {
  const [path = '/', name = 'page'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ ...devices['Pixel 7'] });
  await page.goto(new URL(path, process.env.E2E_BASE_URL ?? 'http://localhost:8081').href);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  await browser.close();
})();
