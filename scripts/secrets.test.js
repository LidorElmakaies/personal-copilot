// node --test scripts/secrets.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { encrypt, decrypt, maskEnv, fillEnv, checkKeystore, collect, planPull, Refusal } = require('./secrets');

const key = crypto.randomBytes(32);
const KS = Buffer.from([0x30, 0x82, 0x10, 0xb8, 1, 2, 3]); // looks like PKCS12
const PROPS = Buffer.from('PC_KEYSTORE_PASSWORD=pw\nPC_KEY_ALIAS=personal-copilot\n');
const keytool = () => 'AA:BB';

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-secrets-'));
  for (const [p, data] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
    fs.writeFileSync(path.join(root, p), data);
  }
  return root;
}
const bundleOf = (files) => ({
  files: Object.fromEntries(Object.entries(files).map(([p, d]) => [p, Buffer.from(d).toString('base64')])),
});

test('encrypts and decrypts; a damaged, tampered or wrong-key bundle is refused', () => {
  const blob = encrypt(Buffer.from('hello'), key);
  assert.strictEqual(decrypt(blob, key).toString(), 'hello');
  const flipped = Buffer.from(blob);
  flipped[flipped.length - 1] ^= 1;
  assert.throws(() => decrypt(flipped, key), Refusal);
  assert.throws(() => decrypt(blob, crypto.randomBytes(32)), Refusal);
  assert.throws(() => decrypt(Buffer.alloc(blob.length), key), /isn't a secrets.js file/);
  assert.notDeepStrictEqual(encrypt(Buffer.from('hello'), key), blob); // fresh IV each time
});

test('per-PC .env keys are stored blank and filled back from this PC', () => {
  const env = '# c\nGATEWAY_PUBLIC_URL=https://a.ts.net:8443\r\nJWT_SECRET=s\n';
  const masked = maskEnv(env, ['GATEWAY_PUBLIC_URL']);
  assert.strictEqual(masked, '# c\nGATEWAY_PUBLIC_URL=\r\nJWT_SECRET=s\n');
  assert.strictEqual(fillEnv(masked, 'GATEWAY_PUBLIC_URL=https://b.ts.net:8443\n', ['GATEWAY_PUBLIC_URL']),
    '# c\nGATEWAY_PUBLIC_URL=https://b.ts.net:8443\r\nJWT_SECRET=s\n');
  assert.strictEqual(fillEnv(masked, undefined, ['GATEWAY_PUBLIC_URL']), masked); // a new PC: left blank
  assert.strictEqual(fillEnv('A=1\n', 'APK_REGISTRY_URL=x', ['APK_REGISTRY_URL']), 'A=1\nAPK_REGISTRY_URL=x\n');
});

test('a keystore that is not one, or has no password, is refused before it goes anywhere', () => {
  assert.strictEqual(checkKeystore(KS, PROPS, keytool), 'AA:BB');
  const broken = Buffer.from([0x05, 0x02, 0x55, 0x44]); // the zero-filled copy from a pulled USB stick
  assert.throws(() => checkKeystore(broken, PROPS, keytool), /isn't a keystore/);
  assert.throws(() => checkKeystore(KS, Buffer.from('PC_KEY_ALIAS=x\n'), keytool), /no PC_KEYSTORE_PASSWORD/);
  assert.throws(() => checkKeystore(KS, PROPS, () => { throw new Refusal('wrong password'); }), /wrong password/);
});

test('push collects this PC\'s files over the bundle\'s, and keeps what this PC lacks', () => {
  const root = tree({
    'backend/.env': 'A=1\n',
    'devops/.env': 'GATEWAY_PUBLIC_URL=https://me.ts.net:8443\nJWT_SECRET=s\n',
    'devops/data/android/release.keystore': KS,
    'devops/data/android/keystore.properties': PROPS,
  });
  const previous = bundleOf({ 'devops/data/android/google-services.json': '{"x":1}', 'backend/.env': 'A=0\n' });
  const { files, done, fingerprint } = collect({ root, previous, keytool });
  assert.strictEqual(Buffer.from(files['backend/.env'], 'base64').toString(), 'A=1\n');
  assert.strictEqual(Buffer.from(files['devops/.env'], 'base64').toString(), 'GATEWAY_PUBLIC_URL=\nJWT_SECRET=s\n');
  assert.strictEqual(Buffer.from(files['devops/data/android/google-services.json'], 'base64').toString(), '{"x":1}');
  assert.deepStrictEqual(done.length, 4);
  assert.strictEqual(fingerprint, 'AA:BB');
});

test('pull: same files are left, new ones created, a different signing key or pepper refused', () => {
  const root = tree({
    'backend/.env': 'PASSWORD_PEPPER=mine\n',
    'devops/.env': 'GATEWAY_PUBLIC_URL=https://me.ts.net:8443\nJWT_SECRET=s\n',
    'devops/data/android/release.keystore': Buffer.from([0x30, 0x82, 9]),
    'devops/data/android/keystore.properties': PROPS,
  });
  const bundle = bundleOf({
    'backend/.env': 'PASSWORD_PEPPER=theirs\n',
    'devops/.env': 'GATEWAY_PUBLIC_URL=\nJWT_SECRET=s\n',
    'devops/data/android/release.keystore': KS,
    'devops/data/android/keystore.properties': PROPS,
    'devops/data/android/google-services.json': '{}',
  });
  const by = (plan) => Object.fromEntries(plan.map((p) => [p.path, p.action]));
  assert.deepStrictEqual(by(planPull(bundle, { root })), {
    'backend/.env': 'refuse',
    'devops/.env': 'same', // its per-PC URL is kept
    'devops/data/android/release.keystore': 'refuse',
    'devops/data/android/keystore.properties': 'same',
    'devops/data/android/google-services.json': 'create',
  });
  const forced = by(planPull(bundle, { root, force: true }));
  assert.strictEqual(forced['backend/.env'], 'write');
  assert.strictEqual(forced['devops/data/android/release.keystore'], 'write');
});

test('pull onto a PC without the files creates them all, no refusals', () => {
  const root = tree({});
  const bundle = bundleOf({ 'backend/.env': 'PASSWORD_PEPPER=p\n', 'devops/data/android/release.keystore': KS });
  assert.deepStrictEqual(planPull(bundle, { root }).map((p) => p.action), ['create', 'create']);
});
