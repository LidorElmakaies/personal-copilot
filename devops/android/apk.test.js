// Tests apk.js's publish() against temp folders, the release event it sends, and the versionCode it
// shares with the app: node --test devops/android/apk.test.js
'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { publish: publishApk, releaseEvent, Refusal } = require('./apk.js');

let IN, OUT;
const at = (dir, f) => path.join(dir, f);
const readJson = (f) => JSON.parse(fs.readFileSync(at(OUT, f), 'utf8'));
const html = () => fs.readFileSync(at(OUT, 'index.html'), 'utf8');

function apk(version, content = `apk ${version}`) {
  fs.writeFileSync(at(IN, `personal-copilot-${version}.apk`), content);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Like the command line: exit code 1 and the message on a refusal.
function publish(version, ...notes) {
  try {
    return { code: 0, out: publishApk({ version, notes, built: IN, registry: OUT }) };
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    return { code: 1, out: e.message };
  }
}

function ok(...args) {
  const r = publish(...args);
  assert.equal(r.code, 0, r.out);
  return r;
}

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-registry-'));
  IN = at(tmp, 'in');
  OUT = at(tmp, 'out');
  fs.mkdirSync(IN);
  fs.mkdirSync(OUT);
});

test('publishes a first version: APK, releases.json, latest.json and the page', () => {
  const sha = apk('0.1.0');
  ok('0.1.0', 'First build', 'Second bullet');

  assert.equal(fs.readFileSync(at(OUT, 'personal-copilot-0.1.0.apk'), 'utf8'), 'apk 0.1.0');
  const [r] = readJson('releases.json');
  assert.deepEqual(
    { ...r, publishedAt: undefined },
    {
      version: '0.1.0',
      versionCode: 10099,
      file: 'personal-copilot-0.1.0.apk',
      sha256: sha,
      size: 9,
      publishedAt: undefined,
      notes: ['First build', 'Second bullet'],
    },
  );
  assert.match(r.publishedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.deepEqual(readJson('latest.json'), {
    version: '0.1.0',
    versionCode: 10099,
    url: '/apk/personal-copilot-0.1.0.apk',
    sha256: sha,
    notes: ['First build', 'Second bullet'],
    publishedAt: r.publishedAt,
  });
  const page = html();
  assert.match(page, /<strong>0\.1\.0<\/strong><span class="badge latest">Latest<\/span>/);
  assert.match(page, /href="personal-copilot-0\.1\.0\.apk" download/);
  assert.match(page, /<li>First build<\/li><li>Second bullet<\/li>/);
  assert.match(page, /<svg aria-hidden="true" /);
  assert.doesNotMatch(page, /<!--/, 'icon comment stripped');
  assert.deepEqual(fs.readdirSync(OUT).filter((f) => f.endsWith('.tmp')), []);
});

test('escapes notes in the page', () => {
  apk('0.1.0');
  ok('0.1.0', `<script>alert("x")</script> & 'q'`);
  const page = html();
  assert.doesNotMatch(page, /<script>alert/);
  assert.match(page, /&#60;script&#62;alert\(&#34;x&#34;\)&#60;\/script&#62; &#38; &#39;q&#39;/);
});

test('sorts by versionCode, newest first; latest is the newest non-test release', () => {
  for (const v of ['0.1.0', '0.1.1-test.1', '0.1.1-test.2', '0.2.0-test.1', '0.0.9', '0.1.1', '0.10.0-test.1']) {
    apk(v);
  }
  ok('0.1.0', 'a');
  ok('0.1.1-test.1', 'b');
  assert.equal(readJson('latest.json').version, '0.1.0', 'a test build never becomes latest');
  ok('0.1.1', 'c');
  ok('0.1.1-test.2', 'd'); // published after its release: still sorts below it
  ok('0.0.9', 'e'); // an older release published late doesn't take over latest
  ok('0.2.0-test.1', 'f');
  ok('0.10.0-test.1', 'g'); // 0.10 > 0.2 numerically, not as strings

  assert.deepEqual(
    readJson('releases.json').map((r) => r.version),
    ['0.10.0-test.1', '0.2.0-test.1', '0.1.1', '0.1.1-test.2', '0.1.1-test.1', '0.1.0', '0.0.9'],
  );
  assert.equal(readJson('latest.json').version, '0.1.1');
  const page = html();
  assert.equal(page.match(/badge latest/g).length, 1);
  assert.equal(page.match(/badge test/g).length, 4);
  assert.match(page, /<li class="rel now">\s*<div class="relTop"><strong>0\.1\.1<\/strong>/);
});

test('only test builds: no latest.json', () => {
  apk('0.2.0-test.1');
  ok('0.2.0-test.1', 'try it');
  assert.equal(fs.existsSync(at(OUT, 'latest.json')), false);
  assert.equal(readJson('releases.json').length, 1);
  assert.doesNotMatch(html(), /badge latest/);
});

test('same version and file: new notes replace the old, none just regenerate', () => {
  apk('0.1.0');
  ok('0.1.0', 'old');
  const before = readJson('releases.json')[0];

  assert.match(ok('0.1.0', 'new one', 'two').out, /notes updated/);
  const after = readJson('releases.json')[0];
  assert.deepEqual(after, { ...before, notes: ['new one', 'two'] });
  assert.deepEqual(readJson('latest.json').notes, ['new one', 'two']);
  assert.match(html(), /<li>new one<\/li><li>two<\/li>/);
  assert.doesNotMatch(html(), /<li>old<\/li>/);

  fs.rmSync(at(OUT, 'index.html'));
  assert.match(ok('0.1.0').out, /page regenerated/);
  assert.deepEqual(readJson('releases.json')[0], after);
  assert.match(html(), /<li>new one<\/li>/);
});

test('same version with a different file is refused and changes nothing', () => {
  apk('0.1.0', 'original');
  ok('0.1.0', 'first');
  const snapshot = ['releases.json', 'latest.json', 'index.html', 'personal-copilot-0.1.0.apk'].map((f) =>
    fs.readFileSync(at(OUT, f), 'utf8'),
  );

  apk('0.1.0', 'rebuilt');
  const r = publish('0.1.0', 'sneaky');
  assert.equal(r.code, 1);
  assert.match(r.out, /already published with a different APK/);
  assert.deepEqual(
    ['releases.json', 'latest.json', 'index.html', 'personal-copilot-0.1.0.apk'].map((f) =>
      fs.readFileSync(at(OUT, f), 'utf8'),
    ),
    snapshot,
  );
});

test('refuses: no version, bad version, missing APK, new version without notes', () => {
  apk('0.1.0');
  for (const [args, message] of [
    [[], /usage/],
    [['1.2', 'x'], /not MAJOR\.MINOR\.PATCH/],
    [['v0.1.0', 'x'], /not MAJOR\.MINOR\.PATCH/],
    [['0.1.0-beta', 'x'], /not MAJOR\.MINOR\.PATCH/],
    [['0.3.0', 'x'], /No personal-copilot-0\.3\.0\.apk/],
    [['0.1.0'], /release notes/],
  ]) {
    const r = publish(...args);
    assert.equal(r.code, 1, `${args.join(' ')}: ${r.out}`);
    assert.match(r.out, message);
  }
  assert.deepEqual(fs.readdirSync(OUT), [], 'nothing written');
});

test('a published version keeps working after its build output is gone', () => {
  apk('0.1.0');
  ok('0.1.0', 'First build');
  fs.rmSync(at(IN, 'personal-copilot-0.1.0.apk'));

  ok('0.1.0', 'Reworded');
  assert.deepEqual(readJson('releases.json')[0].notes, ['Reworded']);
  fs.rmSync(at(OUT, 'personal-copilot-0.1.0.apk'));
  const r = publish('0.1.0');
  assert.equal(r.code, 1);
  assert.match(r.out, /missing/);
});

test('restores a published APK missing from the registry', () => {
  apk('0.1.0');
  ok('0.1.0', 'First build');
  fs.rmSync(at(OUT, 'personal-copilot-0.1.0.apk'));

  assert.match(ok('0.1.0').out, /restored/);
  assert.equal(fs.readFileSync(at(OUT, 'personal-copilot-0.1.0.apk'), 'utf8'), 'apk 0.1.0');
});

test('blank notes are dropped; only blank notes count as none', () => {
  apk('0.1.0');
  assert.equal(publish('0.1.0', '', '  ').code, 1);
  ok('0.1.0', ' First build ', '');
  assert.deepEqual(readJson('releases.json')[0].notes, ['First build']);
});

test('the page tells how to get past the install warnings', () => {
  apk('0.1.0');
  ok('0.1.0', 'First build');
  assert.match(html(), /allow installs from Chrome once/);
  assert.match(html(), /More details → Install anyway/);
});

// versionCode lives with the app (frontend/src/utils/versionCode.js): app.config.js stamps it on the
// APK, publish writes it to latest.json, the app compares the two.
const { versionCode } = require('../../frontend/src/utils/versionCode.js');

test('versionCode: test builds sort below their release, releases below the next patch', () => {
  assert.equal(versionCode('1.3.0-test.2'), 1030002);
  assert.equal(versionCode('1.3.0'), 1030099);
  assert.equal(versionCode('1.3.1-test.1'), 1030101);
  const order = ['0.9.9', '1.3.0-test.1', '1.3.0-test.2', '1.3.0', '1.3.1-test.1', '1.3.1', '1.10.0', '2.0.0-test.1'];
  const codes = order.map(versionCode);
  assert.deepEqual([...codes].sort((a, b) => a - b), codes);
});

test('versionCode: rejects anything but MAJOR.MINOR.PATCH[-test.N]', () => {
  for (const bad of ['', '1.3', '1.3.0.1', 'v1.3.0', '1.3.0-beta.1', '1.3.0-test', '1.3.0-test.x', ' 1.3.0', undefined]) {
    assert.throws(() => versionCode(bad), /not MAJOR\.MINOR\.PATCH\[-test\.N\]/, String(bad));
  }
});

test('app.config.js stamps versionCode from FRONTEND_VERSION, app.json as is without it', () => {
  const appConfig = require('../../frontend/app.config.js');
  const config = { name: 'x', android: { package: 'p' } };
  const saved = process.env.FRONTEND_VERSION;
  try {
    delete process.env.FRONTEND_VERSION;
    assert.deepEqual(appConfig({ config }), config);
    process.env.FRONTEND_VERSION = '1.3.0-test.2';
    const out = appConfig({ config });
    assert.equal(out.version, '1.3.0-test.2');
    assert.deepEqual(out.android, { package: 'p', versionCode: 1030002 });
  } finally {
    if (saved === undefined) delete process.env.FRONTEND_VERSION;
    else process.env.FRONTEND_VERSION = saved;
  }
});

test("the release event is latest.json's version, versionCode and publish time, keyed by platform", () => {
  const latest = {
    version: '0.4.0',
    versionCode: 40099,
    url: '/apk/personal-copilot-0.4.0.apk',
    sha256: 'abc',
    notes: ['Something new'],
    publishedAt: '2026-10-09T12:00:00Z',
  };
  const { key, value } = releaseEvent(latest);
  assert.equal(key, 'android');
  assert.deepEqual(JSON.parse(value), {
    version: '0.4.0',
    versionCode: 40099,
    publishedAt: '2026-10-09T12:00:00Z',
  });
  // One line: kafka-console-producer reads one message per line.
  assert.ok(!value.includes('\n'));
});
