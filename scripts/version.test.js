// node --test scripts/version.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bump, Refusal } = require('./version');

test('a release bump resets what is to its right', () => {
  assert.strictEqual(bump('1.2.3', 'major'), '2.0.0');
  assert.strictEqual(bump('1.2.3', 'minor'), '1.3.0');
  assert.strictEqual(bump('1.2.3', 'patch'), '1.2.4');
});

test('--test starts a test build of the bump, and continues it', () => {
  assert.strictEqual(bump('1.2.0', 'minor', true), '1.3.0-test.1');
  assert.strictEqual(bump('1.3.0-test.1', 'minor', true), '1.3.0-test.2');
  assert.strictEqual(bump('1.3.0-test.2', 'patch', true), '1.3.0-test.3');
  assert.strictEqual(bump('0.4.0-test.2', 'patch', true), '0.4.0-test.3');
});

test('a plain bump of a test build of the same level releases it', () => {
  assert.strictEqual(bump('1.3.0-test.4', 'minor'), '1.3.0');
  assert.strictEqual(bump('1.3.0-test.4', 'patch'), '1.3.0');
  assert.strictEqual(bump('2.0.0-test.1', 'major'), '2.0.0');
});

test('a bigger bump than the test build moves past it', () => {
  assert.strictEqual(bump('1.3.1-test.2', 'minor'), '1.4.0');
  assert.strictEqual(bump('1.3.0-test.2', 'major'), '2.0.0');
  assert.strictEqual(bump('1.3.0-test.2', 'major', true), '2.0.0-test.1');
});

test('release drops -test.N, and refuses a version that is not a test build', () => {
  assert.strictEqual(bump('1.3.0-test.5', 'release'), '1.3.0');
  assert.throws(() => bump('1.3.0', 'release'), Refusal);
});

test('refuses what Android versionCode or the format cannot hold', () => {
  assert.throws(() => bump('1.99.0', 'minor'), /≤ 99/);
  assert.throws(() => bump('1.2.99', 'patch'), /≤ 99/);
  assert.throws(() => bump('1.2.0-test.98', 'patch', true), /more than 98/);
  assert.throws(() => bump('1.2', 'patch'), Refusal);
  assert.throws(() => bump('1.2.3', 'huge'), /level must be/);
});
