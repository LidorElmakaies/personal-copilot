// Renders frontend/assets/icon/icon.svg to every PNG the app needs. Run via render-icons.sh.
const fs = require('fs');
const { chromium } = require('playwright');

const SRC = '/frontend/assets/icon/icon.svg';
// viewBox crops of the 108 canvas: FULL keeps Android's adaptive margins (and the maskable web
// icon's safe zone); TIGHT trims them for icons shown as-is (favicon, Apple, splash).
const FULL = '0 0 108 108';
const TIGHT = '14 14 80 80';

const OUTPUTS = [
  // Android adaptive icon: two layers, launcher crops and masks them.
  { file: 'assets/images/adaptive-foreground.png', size: 1024, viewBox: FULL, hide: 'background' },
  { file: 'assets/images/adaptive-background.png', size: 1024, viewBox: FULL, hide: 'foreground' },
  // Legacy/iOS icon and the splash image (foreground only, on the splash background color).
  { file: 'assets/images/icon.png', size: 1024, viewBox: TIGHT },
  { file: 'assets/images/splash-icon.png', size: 1024, viewBox: TIGHT, hide: 'background' },
  // Web: favicon (app.json web.favicon) and the set the web manifest links.
  { file: 'assets/images/favicon.png', size: 48, viewBox: TIGHT },
  { file: 'public/icons/icon-192.png', size: 192, viewBox: TIGHT },
  { file: 'public/icons/icon-512.png', size: 512, viewBox: TIGHT },
  { file: 'public/icons/icon-maskable-512.png', size: 512, viewBox: FULL },
  { file: 'public/icons/apple-touch-icon.png', size: 180, viewBox: TIGHT },
];

(async () => {
  const svg = fs.readFileSync(SRC, 'utf8');
  const browser = await chromium.launch();
  for (const o of OUTPUTS) {
    const page = await browser.newPage({ viewport: { width: o.size, height: o.size } });
    const body = svg
      .replace(/viewBox="[^"]*"/, `viewBox="${o.viewBox}" width="${o.size}" height="${o.size}"`)
      .replace('<defs>', `<defs><style>${o.hide ? `#${o.hide}{display:none}` : ''}</style>`);
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${body}`);
    fs.mkdirSync(`/frontend/${o.file.replace(/\/[^/]+$/, '')}`, { recursive: true });
    await page.screenshot({ path: `/frontend/${o.file}`, omitBackground: true });
    await page.close();
    console.log(`${o.file} (${o.size}px)`);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
