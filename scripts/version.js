// The project's versions live in version/versions.json, one per deployable component — each is its
// own. Semver MAJOR.MINOR.PATCH, optionally -test.N for test builds. See CLAUDE.md's "Versions".
// Plain Node, Linux and Windows alike.
//
//   node scripts/version.js                                  show every version
//   node scripts/version.js <component> major|minor|patch    release bump (resets what's to its right)
//   node scripts/version.js <component> major|minor|patch --test
//                                                            next test build of that bump: 1.2.0 →
//                                                            minor --test → 1.3.0-test.1, again → 1.3.0-test.2
//   node scripts/version.js <component> release              1.3.0-test.5 → 1.3.0
//
// Never touches git: after committing, tag the commit yourself (it prints the command).
// Tests: node --test scripts/version.test.js
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../version/versions.json');

class Refusal extends Error {}

const parse = (version) => {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-test\.(\d+))?$/.exec(version);
  if (!m) throw new Refusal(`${version} isn't MAJOR.MINOR.PATCH[-test.N]`);
  const [major, minor, patch] = [m[1], m[2], m[3]].map(Number);
  return { major, minor, patch, test: m[4] ? Number(m[4]) : null };
};

/** The version after a bump of `level` ('major' | 'minor' | 'patch' | 'release'), a test build if `test`. */
function bump(version, level, test = false) {
  const v = parse(version);
  const core = `${v.major}.${v.minor}.${v.patch}`;
  if (level === 'release') {
    if (v.test === null) throw new Refusal(`${version} isn't a test build — nothing to release`);
    return core;
  }
  const targets = {
    major: `${v.major + 1}.0.0`,
    minor: `${v.major}.${v.minor + 1}.0`,
    patch: `${v.major}.${v.minor}.${v.patch + 1}`,
  };
  let target = targets[level];
  if (!target) throw new Refusal('level must be major, minor, patch or release');
  // Already a test build of a version: the next bump of the same level continues from it.
  if (v.test !== null) {
    const same = {
      major: v.minor === 0 && v.patch === 0,
      minor: v.patch === 0,
      patch: true,
    }[level];
    if (same) target = core;
  }
  if (test) {
    const n = target === core && v.test !== null ? v.test + 1 : 1;
    if (n > 98) throw new Refusal(`more than 98 test builds of ${target}`);
    target = `${target}-test.${n}`;
  }
  const t = parse(target);
  // Android's versionCode (frontend/src/utils/versionCode.js) has two digits each for them.
  if (t.minor > 99 || t.patch > 99) {
    throw new Refusal('minor and patch must stay ≤ 99 (Android versionCode)');
  }
  return target;
}

function main(args) {
  const versions = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (args.length === 0) {
    process.stdout.write(fs.readFileSync(FILE, 'utf8'));
    return;
  }
  const [component, level, flag] = args;
  if (!(component in versions)) {
    throw new Refusal(`unknown component '${component}' — one of: ${Object.keys(versions).join(' ')}`);
  }
  if (!level) {
    throw new Refusal('usage: node scripts/version.js <component> major|minor|patch [--test] | release');
  }
  const old = versions[component];
  const next = bump(old, level, flag === '--test');
  versions[component] = next;
  fs.writeFileSync(FILE, `${JSON.stringify(versions, null, 2)}\n`);
  console.log(`${component}: ${old} → ${next}`);
  console.log(`After committing: git tag ${component}-v${next}`);
}

module.exports = { bump, Refusal };

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof Refusal)) throw err;
    console.error(err.message);
    process.exit(1);
  }
}
