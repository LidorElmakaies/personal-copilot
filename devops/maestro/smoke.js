// The phone smoke tests: the Maestro flows in frontend/maestro/ against the installed APK over adb,
// run in Docker (Dockerfile here). An opt-in release check, plain Node on Linux and Windows alike.
//
//   node devops/maestro/smoke.js                        → the phone on USB (Linux)
//   node devops/maestro/smoke.js --device 10.0.0.7:5555 → wireless debugging (Windows, or any)
//   node devops/maestro/smoke.js --quick                → the alarm is set, without waiting for it
//
// Home shows the Shabbat times, a reminder added from the Calendar tab posts its notification (at
// the next 5-minute mark: after Home, the run waits until that is LEAD_MS away), the notification
// opens the app, the reminder is deleted. Reads the phone's state and stops on a permission the
// flows need; touches no setting and no app data. Screenshots: devops/data/maestro/<time>/.
// Tests: node --test devops/maestro/smoke.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const IMAGE = 'personal-copilot-maestro';
const APP = 'com.lidor.personalcopilot';
const MAESTRO_APPS = ['dev.mobile.maestro', 'dev.mobile.maestro.test'];
const TIME_ZONE = 'Asia/Jerusalem';
const FORM_HOUR = 19; // the reminder form starts at 19:00
// From starting add-reminder.yaml to the reminder saved, with room to spare: up to 30 steps of
// ~3 s at 00:00, plus Maestro's start.
const LEAD_MS = 150_000;
// How long after its time the notification may take to show.
const POST_GRACE_MS = 60_000;

// A refusal: printed without a stack trace.
class Refusal extends Error {}

// ---- pure helpers (smoke.test.js) ----

// Israel's wall-clock parts of `ms`.
function israelParts(ms) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: +get('hour'), minute: +get('minute') };
}

// The first 5-minute mark at least `lead` ms after `now`: { at, hour, minute, time }, or null when it
// falls on another day in Israel (the form adds to today) or in the hour the clocks go back (the
// form's wall-clock time could mean the earlier one, already past).
function nextSlot(now, lead = LEAD_MS) {
  const step = 5 * 60_000;
  const at = Math.ceil((now + lead) / step) * step;
  const p = israelParts(at);
  if (p.date !== israelParts(now).date) return null;
  const same = (q) => q.date === p.date && q.hour === p.hour && q.minute === p.minute;
  if (same(israelParts(at - 3_600_000)) || same(israelParts(at + 3_600_000))) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return { at, hour: p.hour, minute: p.minute, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

// `dumpsys package <app>` → { installed, version, granted: { permission: true|false } }.
function parsePackage(text) {
  const version = /versionName=(\S+)/.exec(text)?.[1] ?? null;
  const granted = {};
  for (const m of text.matchAll(/^\s*(android\.permission\.\w+): granted=(true|false)/gm))
    granted[m[1]] ??= m[2] === 'true';
  return { installed: version !== null, version, granted };
}

// The permissions the flows need that aren't granted.
function missingPermissions(granted) {
  const missing = [];
  if (!granted['android.permission.POST_NOTIFICATIONS']) missing.push('Notifications');
  if (!granted['android.permission.ACCESS_FINE_LOCATION'] && !granted['android.permission.ACCESS_COARSE_LOCATION'])
    missing.push('Location');
  if (!granted['android.permission.USE_EXACT_ALARM'] && !granted['android.permission.SCHEDULE_EXACT_ALARM'])
    missing.push('Alarms & reminders');
  return missing;
}

// Each permission whose grant differs between two `parsePackage(...).granted`.
function changedPermissions(before, after) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter((n) => before[n] !== after[n]).sort();
}

// The app's name as a whole word in a dumpsys line (com.lidor.personalcopilot.dev is another app).
const APP_NAME = new RegExp(`(?<![\\w.])${APP.replace(/\./g, '\\.')}(?![\\w.])`);

// Whether `dumpsys notification --noredact` lists one of the app's notifications titled `title`.
function notificationPosted(text, title) {
  return text
    .split(/\n(?=\s*NotificationRecord\()/)
    .some(
      (record) =>
        /pkg=(\S+)/.exec(record)?.[1] === APP && record.includes(`android.title=String (${title})`),
    );
}

// Whether `dumpsys alarm` has one of the app's alarms pending for `at` (ms). The app's name also
// shows in the stats of alarms gone off, so only the pending entries count.
function alarmSet(text, at) {
  return text
    .split('\n')
    .some((line) => /Alarm\{/.test(line) && APP_NAME.test(line) && line.includes(`origWhen ${at}`));
}

// ---- the phone ----

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Refusal(`${cmd} ${args[0]} failed (exit ${r.status}).`);
  return r;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One container for the whole run: the adb server inside it holds the phone.
function startContainer(device) {
  const name = `pc-maestro-${process.pid}`;
  const keys = path.join(os.homedir(), '.android'); // adb's key, which the phone already trusts
  fs.mkdirSync(keys, { recursive: true });
  // Docker creates it when missing (devops/data/ may be root-owned).
  const out = path.join(ROOT, 'devops/data/maestro');
  const usb = device ? [] : ['--privileged', '-v', '/dev/bus/usb:/dev/bus/usb'];
  // A killed run's container still holds the phone (and its flow keeps going): gone first.
  const stale = spawnSync('docker', ['ps', '-aq', '--filter', 'name=^pc-maestro-'], { encoding: 'utf8' });
  for (const id of (stale.stdout || '').split(/\s+/).filter(Boolean))
    spawnSync('docker', ['rm', '-f', id], { stdio: 'ignore' });
  run('docker', ['build', '-q', '-t', IMAGE, __dirname], { stdio: ['ignore', 'ignore', 'inherit'] });
  run('docker', [
    'run', '-d', '--rm', '--name', name, ...usb,
    '-v', `${keys}:/root/.android`,
    '-v', `${path.join(ROOT, 'frontend/maestro')}:/flows:ro`,
    '-v', `${out}:/out`,
    IMAGE, 'sh', '-c', 'adb start-server && sleep infinity',
  ], { stdio: ['ignore', 'ignore', 'inherit'] });

  const exec = (args, opts = {}) =>
    spawnSync('docker', ['exec', name, ...args], { encoding: 'utf8', ...opts });
  const adb = (...args) => {
    const r = exec(['adb', ...args]);
    if (r.status !== 0) throw new Refusal(`adb ${args.join(' ')} failed: ${(r.stderr || r.stdout).trim()}`);
    return r.stdout;
  };
  return { name, exec, adb, stop: () => spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' }) };
}

async function connect(box, device) {
  if (device) box.adb('connect', device);
  for (let i = 0; i < 30; i++) {
    const rows = box.adb('devices').split('\n').slice(1).map((l) => l.trim().split(/\s+/)).filter((r) => r[1]);
    if (rows.length > 1) throw new Refusal('More than one phone on adb: unplug the others, or pass --device.');
    if (rows[0]?.[1] === 'device') return rows[0][0];
    if (rows[0]?.[1] === 'unauthorized' && i === 0) console.log('Allow USB debugging on the phone (its prompt) ...');
    await sleep(1000);
  }
  throw new Refusal(
    device
      ? `No phone at ${device}: check wireless debugging's address and port on the phone.`
      : 'No phone on USB (or USB debugging not allowed on it). Windows: pass --device <ip:port>.',
  );
}

function appState(box) {
  return parsePackage(box.adb('shell', 'dumpsys', 'package', APP));
}

function installed(box, pkg) {
  return box.adb('shell', 'pm', 'list', 'packages', '--user', '0', pkg).split('\n').some((l) => l.trim() === `package:${pkg}`);
}

// Awake and unlocked; else wakes the screen (a key press) and waits a minute for an unlock.
async function readyScreen(box) {
  const ready = () =>
    /mWakefulness=Awake/.test(box.adb('shell', 'dumpsys', 'power')) &&
    !/mDreamingLockscreen=true|mShowingLockscreen=true|isKeyguardShowing=true/.test(
      box.adb('shell', 'dumpsys', 'window'),
    );
  if (ready()) return;
  box.adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  console.log('Unlock the phone (waiting a minute) ...');
  for (let i = 0; i < 60; i++) {
    if (ready()) return;
    await sleep(1000);
  }
  throw new Refusal('The phone stayed locked.');
}

function maestro(box, serial, out, flow, env) {
  const vars = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
  // The helper apps stay installed between flows; the run removes them at the end.
  const r = box.exec(
    ['maestro', 'test', '--device', serial, '--no-reinstall-driver', '--test-output-dir', `/out/${out}`,
      ...vars, `/flows/${flow}.yaml`],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Refusal(`Flow ${flow} failed — see devops/data/maestro/${out}/.`);
}

async function waitUntil(at, what) {
  for (let left = at - Date.now(); left > 0; left = at - Date.now()) {
    process.stdout.write(`\r${what} in ${Math.ceil(left / 1000)} s   `);
    await sleep(Math.min(left, 1000));
  }
  process.stdout.write('\n');
}

async function smoke({ device, quick }) {
  const box = startContainer(device);
  // Stopping the run stops the container, and the flow running in it.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.on(signal, () => {
      box.stop();
      process.exit(130);
    });
  const out = new Date().toISOString().replace(/[:.]/g, '-');
  let serial, before, title, cleanUp;
  const hadMaestro = {};
  try {
    serial = await connect(box, device);
    before = appState(box);
    if (!before.installed) throw new Refusal(`${APP} isn't installed on the phone.`);
    const missing = missingPermissions(before.granted);
    if (missing.length)
      throw new Refusal(`Not granted to the app: ${missing.join(', ')}. Turn it on yourself, then run again.`);
    for (const pkg of MAESTRO_APPS) hadMaestro[pkg] = installed(box, pkg);
    if (Object.values(hadMaestro).some(Boolean))
      console.log(`Maestro's helper apps were already on the phone: left there (adb uninstall ${MAESTRO_APPS.join(', ')}).`);
    console.log(`Phone ${serial}, Personal Copilot ${before.version}.`);

    await readyScreen(box);
    maestro(box, serial, out, 'home', {});

    const phoneNow = () => Number(box.adb('shell', 'date', '+%s').trim()) * 1000;
    const slot = nextSlot(phoneNow());
    if (!slot) throw new Refusal('The next reminder time is after midnight or in the repeated hour of the clocks going back: run again later.');
    title = `Smoke test ${slot.time.replace(':', '')}`;
    const env = {
      TITLE: title, TIME: slot.time,
      HOUR_BUTTON: slot.hour >= FORM_HOUR ? 'More hours' : 'Fewer hours',
      HOUR_TAPS: Math.abs(slot.hour - FORM_HOUR), MINUTE_TAPS: slot.minute / 5,
    };
    // The phone's clock against the PC's: the waits below use the PC's.
    const skew = phoneNow() - Date.now();
    if (!quick) {
      await waitUntil(slot.at - skew - LEAD_MS, `Reminder "${title}" at ${slot.time}; adding it`);
      await readyScreen(box);
    }
    cleanUp = () => maestro(box, serial, out, 'delete-reminder', env);
    maestro(box, serial, out, 'add-reminder', env);
    if (slot.at - skew <= Date.now()) throw new Refusal(`Saved after ${slot.time}: LEAD_MS is too short.`);

    if (quick) {
      if (!alarmSet(box.adb('shell', 'dumpsys', 'alarm'), slot.at))
        throw new Refusal(`No alarm of ${APP} at ${slot.time} after adding "${title}".`);
      console.log(`Alarm set for "${title}" at ${slot.time}.`);
    } else {
      await waitUntil(slot.at - skew, 'Notification due');
      const deadline = Date.now() + POST_GRACE_MS;
      while (!notificationPosted(box.adb('shell', 'dumpsys', 'notification', '--noredact'), title)) {
        if (Date.now() > deadline) throw new Refusal(`No notification "${title}" by ${slot.time} + 1 min.`);
        await sleep(1000);
      }
      console.log(`Notification "${title}" posted (${Math.round((Date.now() + skew - slot.at) / 1000)} s after ${slot.time}).`);
      await readyScreen(box);
      maestro(box, serial, out, 'notification', env);
    }
    maestro(box, serial, out, 'delete-reminder', env);
    cleanUp = null;
    if (quick && alarmSet(box.adb('shell', 'dumpsys', 'alarm'), slot.at))
      throw new Refusal(`The alarm at ${slot.time} is still set after deleting "${title}".`);

    const changed = changedPermissions(before.granted, appState(box).granted);
    if (changed.length) throw new Refusal(`Permissions changed during the run: ${changed.join(', ')}.`);
    console.log('Smoke tests passed.');
  } finally {
    if (cleanUp) {
      try {
        cleanUp();
      } catch {
        console.error(`Couldn't delete the reminder "${title}": if it was saved, delete it in the app.`);
      }
    }
    if (serial) {
      for (const pkg of MAESTRO_APPS) if (hadMaestro[pkg] === false) box.exec(['adb', 'uninstall', pkg]);
      box.exec(['adb', 'shell', 'cmd', 'statusbar', 'collapse']);
    }
    box.stop();
  }
}

// ---- command line ----

module.exports = {
  nextSlot, parsePackage, missingPermissions, changedPermissions, notificationPosted, alarmSet,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = { quick: false, device: null };
  const usage = 'usage: node devops/maestro/smoke.js [--device <ip:port>] [--quick]';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--quick') options.quick = true;
    else if (args[i] === '--device' && args[i + 1]) options.device = args[++i];
    else {
      console.error(usage);
      process.exit(1);
    }
  }
  smoke(options).catch((e) => {
    if (!(e instanceof Refusal)) throw e;
    console.error(e.message);
    process.exit(1);
  });
}
