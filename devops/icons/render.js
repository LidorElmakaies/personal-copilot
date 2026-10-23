// Renders frontend/assets/icon/icon.svg to every PNG the app needs; re-run after editing the SVG.
// Plain Node, Linux and Windows alike: node devops/icons/render.js
// It runs itself (`inside`) in a pinned Playwright image, so nothing but Docker is needed on the host.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');

const SRC = '/frontend/assets/icon/icon.svg';
// viewBox crops of the 108 canvas: FULL keeps Android's adaptive margins; TIGHT trims them for
// icons shown as-is (legacy icon, splash).
const FULL = '0 0 108 108';
const TIGHT = '14 14 80 80';

const OUTPUTS = [
  // Android adaptive icon: two layers, launcher crops and masks them.
  { file: 'assets/images/adaptive-foreground.png', size: 1024, viewBox: FULL, hide: 'background' },
  { file: 'assets/images/adaptive-background.png', size: 1024, viewBox: FULL, hide: 'foreground' },
  // Legacy/iOS icon and the splash image (foreground only, on the splash background color).
  { file: 'assets/images/icon.png', size: 1024, viewBox: TIGHT },
  { file: 'assets/images/splash-icon.png', size: 1024, viewBox: TIGHT, hide: 'background' },
];

// The image and the playwright package must be the same version.
const PLAYWRIGHT = '1.63.0';
const IMAGE = `mcr.microsoft.com/playwright:v${PLAYWRIGHT}-noble`;

async function render() {
  const { chromium } = require('playwright'); // the container's, via NODE_PATH
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
}

function inDocker() {
  const r = spawnSync(
    'docker',
    [
      'run', '--rm',
      // Linux: write the PNGs as you, not root. Docker Desktop (Windows) maps ownership itself.
      ...(process.getuid ? ['--user', `${process.getuid()}:${process.getgid()}`] : []),
      '-e', 'HOME=/tmp',
      '-v', `${path.join(ROOT, 'frontend')}:/frontend`,
      '-v', `${__dirname}:/icons:ro`,
      IMAGE,
      'sh', '-c',
      `mkdir -p /tmp/pw && cd /tmp/pw && npm i --no-save --no-audit --no-fund --loglevel=error playwright@${PLAYWRIGHT} && NODE_PATH=/tmp/pw/node_modules node /icons/render.js inside`,
    ],
    { stdio: 'inherit' },
  );
  if (r.error) throw r.error;
  process.exit(r.status ?? 1);
}

if (process.argv[2] === 'inside') {
  render().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  inDocker();
}
