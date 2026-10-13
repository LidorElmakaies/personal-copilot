// The project's secrets, shared between this project's PCs as one encrypted file you keep in Google
// Drive (uploaded/downloaded by hand) — never git. Plain Node, Linux and Windows alike. See README's "Secrets between PCs".
//
//   node scripts/secrets.js init            make the key (once, ever; then upload it)
//   node scripts/secrets.js push            encrypt this PC's secrets into secrets.enc (then upload it)
//   node scripts/secrets.js pull            decrypt secrets.enc into place (.bak of whatever it replaces)
//   node scripts/secrets.js status          what's in secrets.enc vs this PC
//   ... pull --force                        past the refusals below
//
// Two files, both in the repo's secrets/ folder (gitignored; SECRETS_DIR overrides): the key
// secrets-key.json (32 random bytes, base64) and the bundle secrets.enc (AES-256-GCM, so a damaged or
// tampered copy fails to open instead of writing garbage). Push overwrites secrets.enc; Google Drive
// keeps the versions you upload over. Refused without --force: a pull that would change the signing
// key or PASSWORD_PEPPER (which breaks every password stored on this PC).
// Tests: node --test scripts/secrets.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.env.SECRETS_DIR || path.join(ROOT, 'secrets');
const KEY_FILE = path.join(DIR, 'secrets-key.json');

// What's shared. `local`: per-PC keys of an .env file, stored blank and filled from this PC's copy.
const FILES = [
  { path: 'backend/.env', env: true },
  { path: 'devops/.env', env: true, local: ['GATEWAY_PUBLIC_URL', 'APK_REGISTRY_URL'] },
  { path: 'devops/data/android/release.keystore', guarded: true },
  { path: 'devops/data/android/keystore.properties', guarded: true },
  { path: 'devops/data/android/google-services.json' },
];

class Refusal extends Error {}

// ---- encryption ----

const MAGIC = Buffer.from('PCSECv1\n');

function encrypt(plain, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(MAGIC);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

function decrypt(blob, key) {
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) throw new Refusal("the bundle isn't a secrets.js file");
  const iv = blob.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = blob.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAAD(MAGIC);
  d.setAuthTag(tag);
  try {
    return Buffer.concat([d.update(blob.subarray(MAGIC.length + 28)), d.final()]);
  } catch {
    throw new Refusal("the bundle doesn't open with this key — a different key, or the file is damaged");
  }
}

function readKey(file = KEY_FILE) {
  if (!fs.existsSync(file)) {
    throw new Refusal(
      `No key at ${file}.\nFirst PC: node scripts/secrets.js init. Other PCs: download secrets-key.json from Google Drive into that folder.`,
    );
  }
  let key;
  try {
    key = Buffer.from(JSON.parse(fs.readFileSync(file, 'utf8')).key, 'base64');
  } catch {}
  if (key?.length !== 32) throw new Refusal(`${file} isn't a secrets.js key ({ "key": 32 bytes, base64 })`);
  return key;
}

// ---- .env files: per-PC keys ----

const envLine = (name) => new RegExp(`^${name}=.*$`, 'm');

/** The .env text with each `local` key's value blanked. */
function maskEnv(text, local = []) {
  return local.reduce((t, name) => t.replace(envLine(name), `${name}=`), text);
}

/** The bundle's .env text with each `local` key's value taken from this PC's copy (if it has one). */
function fillEnv(text, mine, local = []) {
  for (const name of local) {
    const m = mine && envLine(name).exec(mine);
    if (m) text = envLine(name).test(text) ? text.replace(envLine(name), () => m[0]) : `${text}${m[0]}\n`;
  }
  return text;
}

const envValue = (text, name) => {
  const m = text && envLine(name).exec(text);
  return m ? m[0].slice(name.length + 1).trim() : undefined;
};

// ---- checks ----

/** A PKCS12 keystore that opens with keystore.properties' password — via keytool in Docker when
 * there is one. Returns its SHA-256 fingerprint, or null when only the format could be checked. */
function checkKeystore(store, props, keytool = dockerKeytool) {
  if (store[0] !== 0x30 || store[1] !== 0x82) throw new Refusal("release.keystore isn't a keystore (damaged copy?)");
  const password = envValue(props?.toString('utf8'), 'PC_KEYSTORE_PASSWORD');
  if (!password) throw new Refusal('keystore.properties has no PC_KEYSTORE_PASSWORD');
  return keytool(store, password);
}

function dockerKeytool(store, password) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-ks-'));
  try {
    fs.writeFileSync(path.join(tmp, 'release.keystore'), store);
    const r = spawnSync('docker', [
      'run', '--rm', '-v', `${tmp}:/k:ro`, '-e', 'PW', 'eclipse-temurin:21-jre-alpine',
      'sh', '-c', 'keytool -list -v -storetype PKCS12 -keystore /k/release.keystore -storepass:env PW',
    ], { env: { ...process.env, PW: password, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8' });
    if (r.error) return null; // no Docker: the format check above is all we have
    if (r.status !== 0) throw new Refusal(`release.keystore doesn't open with keystore.properties' password`);
    return /SHA256:\s*([0-9A-F:]+)/.exec(r.stdout)?.[1] ?? null;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const short = (fp) => (fp ? `${fp.slice(0, 8)}…${fp.slice(-8)}` : 'format checked only, no Docker');

// ---- bundle ----

function readBundle(key, dir = DIR) {
  const file = path.join(dir, 'secrets.enc');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(decrypt(fs.readFileSync(file), key).toString('utf8'));
}

const fileOf = (bundle, p) => (bundle?.files[p] !== undefined ? Buffer.from(bundle.files[p], 'base64') : undefined);
const readLocal = (root, p) => (fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p)) : undefined);

/** This PC's files over the bundle's (a file this PC lacks keeps the bundle's copy). */
function collect({ root = ROOT, previous, keytool } = {}) {
  const files = { ...(previous?.files ?? {}) };
  const done = [];
  for (const f of FILES) {
    let data = readLocal(root, f.path);
    if (data === undefined) continue;
    if (f.env) data = Buffer.from(maskEnv(data.toString('utf8'), f.local));
    files[f.path] = data.toString('base64');
    done.push(f.path);
  }
  const store = fileOf({ files }, 'devops/data/android/release.keystore');
  let fingerprint;
  if (store) fingerprint = checkKeystore(store, fileOf({ files }, 'devops/data/android/keystore.properties'), keytool);
  return { files, done, fingerprint };
}

/** What a pull would do to each file: same / write / refuse (with why). */
function planPull(bundle, { root = ROOT, force = false } = {}) {
  return FILES.filter((f) => bundle.files[f.path] !== undefined).map((f) => {
    const mine = readLocal(root, f.path);
    let data = fileOf(bundle, f.path);
    if (f.env) data = Buffer.from(fillEnv(data.toString('utf8'), mine?.toString('utf8'), f.local));
    if (mine?.equals(data)) return { ...f, action: 'same' };
    if (!force && mine && f.guarded)
      return { ...f, action: 'refuse', why: 'a different signing key — the installed app is signed with one of them' };
    const pepper = [envValue(mine?.toString('utf8'), 'PASSWORD_PEPPER'), envValue(data.toString('utf8'), 'PASSWORD_PEPPER')];
    if (!force && f.env && pepper[0] && pepper[1] && pepper[0] !== pepper[1])
      return { ...f, action: 'refuse', why: "a different PASSWORD_PEPPER — every password stored on this PC would stop working" };
    return { ...f, action: mine ? 'write' : 'create', data };
  });
}

// ---- commands ----

function init() {
  if (fs.existsSync(KEY_FILE)) throw new Refusal(`${KEY_FILE} already exists — not replacing it.`);
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(
    KEY_FILE,
    `${JSON.stringify({ key: crypto.randomBytes(32).toString('base64'), createdAt: new Date().toISOString(), from: os.hostname() }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(`Key created: ${KEY_FILE}\nUpload it to Google Drive; other PCs download it into their secrets/ folder.`);
}

function push() {
  const key = readKey();
  const previous = readBundle(key);
  const { files, done, fingerprint } = collect({ previous });
  if (!done.length) throw new Refusal('none of the secret files exist on this PC');

  const blob = encrypt(Buffer.from(JSON.stringify({ v: 1, from: os.hostname(), pushedAt: new Date().toISOString(), files })), key);
  const file = path.join(DIR, 'secrets.enc');
  fs.writeFileSync(`${file}.tmp`, blob);
  fs.renameSync(`${file}.tmp`, file);

  console.log(`Pushed to ${file} — upload it to Google Drive (replacing the old one):`);
  for (const p of done) console.log(`  ${p}`);
  if ('devops/data/android/release.keystore' in files) console.log(`  (signing key ${short(fingerprint)})`);
}

function pull(force) {
  const key = readKey();
  const bundle = readBundle(key);
  if (!bundle)
    throw new Refusal(`Nothing at ${path.join(DIR, 'secrets.enc')} — download secrets.enc from Google Drive into that folder.`);
  console.log(`Bundle from ${bundle.from}, ${bundle.pushedAt}:`);
  const plan = planPull(bundle, { force });
  const writes = plan.filter((p) => p.action === 'write' || p.action === 'create');
  const store = writes.find((p) => p.path.endsWith('release.keystore'));
  if (store) {
    const props = plan.find((p) => p.path.endsWith('keystore.properties'));
    const fp = checkKeystore(store.data, props?.data ?? readLocal(ROOT, props?.path ?? 'devops/data/android/keystore.properties'));
    console.log(`  (signing key ${short(fp)})`);
  }
  for (const p of plan) {
    const target = path.join(ROOT, p.path);
    if (p.action === 'write') fs.copyFileSync(target, `${target}.bak`);
    if (p.action === 'write' || p.action === 'create') {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, p.data);
    }
    const what = { same: 'already the same', create: 'created', write: 'updated (old one: .bak)', refuse: `NOT updated: ${p.why}` };
    console.log(`  ${p.path}: ${what[p.action]}`);
  }
  if (plan.some((p) => p.action === 'refuse')) {
    console.log('pull --force to take the bundle\'s anyway (a .bak is kept), or push to make this PC\'s win.');
    process.exitCode = 1;
  }
}

function status() {
  const bundle = readBundle(readKey());
  if (!bundle) return console.log(`Nothing at ${path.join(DIR, 'secrets.enc')} yet.`);
  console.log(`Bundle from ${bundle.from}, ${bundle.pushedAt}:`);
  for (const p of planPull(bundle, { force: true }))
    console.log(`  ${p.path}: ${{ same: 'same here', write: 'differs here', create: 'missing here' }[p.action]}`);
}

module.exports = { encrypt, decrypt, readKey, maskEnv, fillEnv, checkKeystore, collect, planPull, FILES, Refusal };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const force = rest.includes('--force');
  const commands = { init, push, pull: () => pull(force), status };
  try {
    if (!commands[cmd]) throw new Refusal('usage: node scripts/secrets.js init | push | pull [--force] | status');
    commands[cmd]();
  } catch (err) {
    if (!(err instanceof Refusal)) throw err;
    console.error(err.message);
    process.exit(1);
  }
}
