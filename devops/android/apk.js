// The Android app's one script, plain Node on Linux and Windows alike. See README's "Android app (APK)".
//
//   node devops/android/apk.js build                          → devops/data/android/apk/personal-copilot-<version>.apk
//   node devops/android/apk.js publish "New icon" "Fixes"     → https://<pc>.ts.net/apk/ (devops/data/apk/)
//   node devops/android/apk.js publish --version 0.1.0 "Note"
//
// The version is `frontend` in version/versions.json; Android's versionCode comes from it
// (frontend/app.config.js). `build` runs in Docker (the Android SDK lives only in the image,
// Dockerfile here); `publish` writes directly, or through a Node container when devops/data/apk is
// root-owned (Docker created it on Linux). Tests: node --test devops/android
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const IMAGE = 'personal-copilot-android-builder';
const BUILT = path.join(ROOT, 'devops/data/android/apk');
const REGISTRY = path.join(ROOT, 'devops/data/apk');
const ICON = path.join(ROOT, 'frontend/assets/icon/icon.svg');

// A refusal: printed without a stack trace.
class Refusal extends Error {}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Refusal(`${cmd} ${args[0]} failed (exit ${r.status}).`);
}

function frontendVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'version/versions.json'), 'utf8')).frontend;
}

// ---- build ----

function build() {
  const versions = JSON.parse(fs.readFileSync(path.join(ROOT, 'version/versions.json'), 'utf8'));
  let gateway = process.env.GATEWAY_PUBLIC_URL;
  if (!gateway) {
    const env = fs.existsSync(path.join(ROOT, 'devops/.env')) ? fs.readFileSync(path.join(ROOT, 'devops/.env'), 'utf8') : '';
    gateway = (/^GATEWAY_PUBLIC_URL=(.*)$/m.exec(env) || [])[1]?.trim() ?? '';
  }
  if (!gateway.startsWith('https://'))
    throw new Refusal(
      `GATEWAY_PUBLIC_URL must be the HTTPS Gateway URL (devops/.env), got '${gateway}'.\n` +
        "Android blocks plain HTTP. See README's 'Phone access (Tailscale HTTPS)'.",
    );
  const abis = process.env.ANDROID_ABIS || 'arm64-v8a';
  const data = path.join(ROOT, 'devops/data/android');

  run('docker', ['build', '-q', '-t', IMAGE, __dirname], { stdio: ['ignore', 'ignore', 'inherit'] });
  const inImage = (...args) =>
    run('docker', ['run', '--rm', '-v', `${__dirname}:/tools:ro`, '-v', `${data}:/data`, ...args]);

  if (!fs.existsSync(path.join(data, 'release.keystore'))) {
    inImage(IMAGE, 'node', '/tools/apk.js', 'inside-genkey');
    console.log('Created the release signing key in devops/data/android/.');
    console.log('BACK UP release.keystore and keystore.properties from there now — without them, no later');
    console.log('APK can update the installed app.');
  }

  console.log(`Building Personal Copilot ${versions.frontend} for ${gateway} ...`);
  inImage(
    '-v', `${path.join(ROOT, 'frontend')}:/src:ro`,
    '-v', 'pc-android-sdk:/opt/android-sdk',
    '-v', 'pc-android-gradle:/root/.gradle',
    '-v', 'pc-npm-cache:/root/.npm',
    '-e', `FRONTEND_VERSION=${versions.frontend}`,
    '-e', `ANDROID_ABIS=${abis}`,
    '-e', `EXPO_PUBLIC_GATEWAY_ORIGIN=${gateway}`,
    '-e', `EXPO_PUBLIC_APP_VERSION=${versions.app}`,
    '-e', `EXPO_PUBLIC_FRONTEND_VERSION=${versions.frontend}`,
    '-e', `EXPO_PUBLIC_BUILT_AT=${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`,
    IMAGE, 'node', '/tools/apk.js', 'inside-build',
  );
  const suffix = abis === 'arm64-v8a' ? '' : '-emulator';
  console.log(`Done: devops/data/android/apk/personal-copilot-${versions.frontend}${suffix}.apk`);
  console.log('(Back up devops/data/android/release.keystore and keystore.properties if you haven\'t.)');
}

// Inside the builder image: /tools is this folder, /data is devops/data/android/.
function insideGenkey() {
  const password = crypto.randomBytes(24).toString('hex');
  run('keytool', [
    '-genkeypair', '-keystore', '/data/release.keystore', '-storetype', 'PKCS12',
    '-alias', 'personal-copilot', '-keyalg', 'RSA', '-keysize', '4096', '-validity', '36500',
    '-storepass', password, '-keypass', password, '-dname', 'CN=Personal Copilot',
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  fs.writeFileSync('/data/keystore.properties', `PC_KEYSTORE_PASSWORD=${password}\nPC_KEY_ALIAS=personal-copilot\n`);
}

// Inside the builder image, also /src = frontend/ (read-only).
function insideBuild() {
  // A clean copy to build in, without the host's node_modules (installed for another OS) or its .env.
  const skip = ['node_modules', 'android', 'ios', 'dist', 'e2e', '.expo'];
  fs.cpSync('/src', '/work', {
    recursive: true,
    filter: (p) => {
      const top = path.relative('/src', p).split(path.sep)[0];
      return !skip.includes(top) && !top.startsWith('.env');
    },
  });
  run('npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: '/work' });
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], { cwd: '/work' });

  const env = { ...process.env, PC_KEYSTORE_FILE: '/data/release.keystore' };
  for (const line of fs.readFileSync('/data/keystore.properties', 'utf8').split(/\r?\n/)) {
    const m = /^(\w+)=(.*)$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  // Every current Android phone is arm64; building one ABI instead of four is ~4× faster.
  // ANDROID_ABIS=arm64-v8a,x86_64 adds the emulator's, for testing — a separate -emulator file.
  const abis = process.env.ANDROID_ABIS || 'arm64-v8a';
  run('./gradlew', ['assembleRelease', '--no-daemon', `-PreactNativeArchitectures=${abis}`], { cwd: '/work/android', env });

  const suffix = abis === 'arm64-v8a' ? '' : '-emulator';
  fs.mkdirSync('/data/apk', { recursive: true });
  fs.copyFileSync(
    '/work/android/app/build/outputs/apk/release/app-release.apk',
    `/data/apk/personal-copilot-${process.env.FRONTEND_VERSION}${suffix}.apk`,
  );
}

// ---- publish ----

const isTest = (version) => /-test\.\d+$/.test(version);

function writeAtomic(file, data) {
  fs.writeFileSync(`${file}.tmp`, data);
  fs.renameSync(`${file}.tmp`, file);
}

// Puts built/personal-copilot-<version>.apk into the registry folder and rewrites releases.json
// (every version), latest.json (the newest release, never a -test.N build) and index.html.
// Returns what it did; throws a Refusal before writing anything when it won't.
function publish({ version, notes = [], built = BUILT, registry = REGISTRY, icon = ICON }) {
  notes = notes.map((n) => n.trim()).filter(Boolean);
  if (!version) throw new Refusal('usage: node devops/android/apk.js publish [--version X] "note" ...');
  const { versionCode } = require(path.join(ROOT, 'frontend/app.config.js'));
  let code;
  try {
    code = versionCode(version);
  } catch (e) {
    throw new Refusal(e.message);
  }

  const file = `personal-copilot-${version}.apk`;
  const src = path.join(built, file);
  const dest = path.join(registry, file);
  const haveBuild = fs.existsSync(src);
  const sha256 = haveBuild ? crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') : null;
  const releasesFile = path.join(registry, 'releases.json');
  const releases = fs.existsSync(releasesFile) ? JSON.parse(fs.readFileSync(releasesFile, 'utf8')) : [];
  const existing = releases.find((r) => r.version === version);
  const copyIn = () => {
    fs.copyFileSync(src, `${dest}.tmp`);
    fs.renameSync(`${dest}.tmp`, dest);
  };
  const done = [];

  if (existing) {
    // The build output may be gone by now; it's only needed to restore a missing published copy.
    if (haveBuild && existing.sha256 !== sha256)
      throw new Refusal(
        `${version} is already published with a different APK (sha256 ${existing.sha256.slice(0, 12)}…, ` +
          `this one ${sha256.slice(0, 12)}…). Published versions never change — bump the version ` +
          '(scripts/version.sh frontend patch) and build again.',
      );
    if (!fs.existsSync(dest)) {
      if (!haveBuild) throw new Refusal(`${file} is missing from devops/data/apk/ and devops/data/android/apk/.`);
      copyIn();
      done.push(`${version}: restored the missing ${file}.`);
    }
    if (notes.length) existing.notes = notes;
    done.push(notes.length ? `${version}: notes updated.` : `${version}: already published, page regenerated.`);
  } else {
    if (!haveBuild) throw new Refusal(`No ${file} in devops/data/android/apk/ — build it first: node devops/android/apk.js build`);
    if (!notes.length) throw new Refusal(`Give ${version}'s release notes as arguments, one per bullet on the page.`);
    copyIn();
    releases.push({
      version,
      versionCode: code,
      file,
      sha256,
      size: fs.statSync(src).size,
      publishedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      notes,
    });
    done.push(`${version} published (versionCode ${code}, sha256 ${sha256.slice(0, 12)}…).`);
  }

  releases.sort((a, b) => b.versionCode - a.versionCode);
  writeAtomic(releasesFile, JSON.stringify(releases, null, 2) + '\n');

  const latest = releases.find((r) => !isTest(r.version));
  const latestFile = path.join(registry, 'latest.json');
  if (latest) {
    const { version: v, versionCode: vc, file: f, sha256: s, notes: n, publishedAt } = latest;
    writeAtomic(
      latestFile,
      JSON.stringify({ version: v, versionCode: vc, url: `/apk/${f}`, sha256: s, notes: n, publishedAt }, null, 2) + '\n',
    );
  } else {
    fs.rmSync(latestFile, { force: true });
  }

  writeAtomic(path.join(registry, 'index.html'), page(releases, latest, fs.readFileSync(icon, 'utf8')));
  return done.join('\n');
}

function publishCli(args) {
  let version = frontendVersion();
  if (args[0] === '--version') {
    version = args[1];
    args = args.slice(2);
  }
  try {
    fs.mkdirSync(REGISTRY, { recursive: true });
    fs.accessSync(REGISTRY, fs.constants.W_OK);
  } catch {
    // Root-owned (Docker made it): publish from a container, as root.
    console.log('devops/data/apk/ is not writable here — publishing through a Node container.');
    run('docker', [
      'run', '--rm', '-v', `${ROOT}:/repo:ro`, '-v', `${REGISTRY}:/repo/devops/data/apk`,
      'node:22-alpine', 'node', '/repo/devops/android/apk.js', 'publish', '--version', version, ...args,
    ]);
    return;
  }
  console.log(publish({ version, notes: args }));
}

// ---- the download page ----

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function when(iso) {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function release(r, latest) {
  const now = r === latest;
  const badge = now
    ? '<span class="badge latest">Latest</span>'
    : isTest(r.version)
      ? '<span class="badge test">Test build</span>'
      : '';
  return `
      <li class="rel${now ? ' now' : ''}">
        <div class="relTop"><strong>${esc(r.version)}</strong>${badge}<a class="get" href="${esc(r.file)}" download>Download</a></div>
        <small><time datetime="${esc(r.publishedAt)}">${when(r.publishedAt)}</time> · ${(r.size / 1e6).toFixed(1)} MB · SHA-256 <code>${r.sha256.slice(0, 4)}…${r.sha256.slice(-4)}</code></small>
        <ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      </li>`;
}

function page(releases, latest, iconSvg) {
  const icon = iconSvg.replace(/<!--[\s\S]*?-->\s*/g, '').trim();
  const favicon = `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Personal Copilot · Android</title>
<link rel="icon" type="image/svg+xml" href="${favicon}">
<style>
:root{
  --bg:#eef1f4;--panel:#ffffff;--card:rgba(20,30,40,0.06);--cardBorder:rgba(20,30,40,0.14);
  --cardBorderSoft:rgba(20,30,40,0.08);--accent:#0e8fa6;--accentSoft:rgba(14,143,166,0.12);--onAccent:#ffffff;
  --text:#1b1f24;--muted:#5b6570;--faint:#6b7680;--success:#12a866;--successBg:rgba(18,168,102,0.12);
  --pending:#c9791a;--pendingBg:rgba(201,121,26,0.12);--glow:rgba(14,143,166,0.18);
  --mono:ui-monospace,"JetBrains Mono",Menlo,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme: dark){:root{
  --bg:#0a0c0f;--panel:#12151a;--card:rgba(255,255,255,0.07);--cardBorder:rgba(255,255,255,0.14);
  --cardBorderSoft:rgba(255,255,255,0.08);--accent:#4fe3ff;--accentSoft:rgba(79,227,255,0.12);--onAccent:#04141a;
  --text:#e8ecf0;--muted:#8b939e;--faint:#7d8792;--success:#3ddc84;--successBg:rgba(61,220,132,0.14);
  --pending:#ffb84f;--pendingBg:rgba(255,184,79,0.14);--glow:rgba(79,227,255,0.16);
}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 var(--sans)}
main{max-width:560px;margin:0 auto;padding:28px 16px 40px;display:flex;flex-direction:column;gap:14px}
.head{display:flex;align-items:center;gap:12px}
.head svg{width:52px;height:52px;border-radius:14px;flex:none}
.head h1{margin:0;font-size:19px}
.head p{margin:0;font-size:12.5px;color:var(--muted)}
.hint{font-size:12.5px;color:var(--pending);background:var(--pendingBg);border-radius:12px;padding:10px 12px;margin:0}
.card{background:var(--card);border:1px solid var(--cardBorder);border-radius:20px;padding:18px 16px;box-shadow:0 0 28px -6px var(--glow)}
.timeline{list-style:none;margin:0;padding:0 0 0 22px;position:relative;display:flex;flex-direction:column;gap:18px}
.timeline::before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:2px;background:var(--cardBorderSoft)}
.rel{position:relative;display:flex;flex-direction:column;gap:6px}
.rel::before{content:"";position:absolute;left:-21px;top:7px;width:10px;height:10px;border-radius:50%;background:var(--panel);border:2px solid var(--faint)}
.rel.now::before{border-color:var(--accent);background:var(--accent);box-shadow:0 0 0 4px var(--accentSoft)}
.relTop{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.relTop strong{font:700 16px var(--mono)}
.badge{font:700 10px var(--mono);letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:2px 8px}
.badge.latest{color:var(--success);background:var(--successBg)}
.badge.test{color:var(--pending);background:var(--pendingBg)}
.get{margin-left:auto;font:600 13px var(--sans);color:var(--accent);border:1px solid var(--cardBorder);border-radius:999px;padding:7px 14px;text-decoration:none}
.rel.now .get{background:var(--accent);color:var(--onAccent);border-color:var(--accent)}
.rel small{font-size:11.5px;color:var(--faint)}
.rel code{font:11px var(--mono)}
.notes{margin:0;padding-left:18px;list-style:disc;font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:2px}
</style>
</head>
<body>
<main>
  <header class="head">
    ${icon.replace('<svg ', '<svg aria-hidden="true" ')}
    <div><h1>Personal Copilot</h1><p>Android app · every version, newest first</p></div>
  </header>
  <p class="hint">First install from here? Android asks to allow installs from Chrome once. If Play Protect blocks the app as from an unknown developer, tap More details → Install anyway. Updating keeps your login.</p>
  <section class="card">
    <ol class="timeline">${releases.map((r) => release(r, latest)).join('')}
    </ol>
  </section>
</main>
<script>
// Publish times in the phone's own time zone (the page is generated in UTC).
document.querySelectorAll('time[datetime]').forEach(function (t) {
  t.textContent = new Date(t.dateTime).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
});
</script>
</body>
</html>
`;
}

// ---- command line ----

module.exports = { publish, Refusal };

if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);
  const commands = { build, publish: () => publishCli(args), 'inside-build': insideBuild, 'inside-genkey': insideGenkey };
  try {
    if (!commands[command]) throw new Refusal('usage: node devops/android/apk.js build | publish [--version X] "note" ...');
    commands[command]();
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    console.error(e.message);
    process.exit(1);
  }
}
