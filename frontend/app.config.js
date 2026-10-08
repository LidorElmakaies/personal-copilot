// Extends app.json with what changes per build: the version and Android's versionCode, from
// FRONTEND_VERSION (set by `node devops/android/apk.js build` from version/versions.json). Unset —
// the web build, a dev server — app.json is used as is.

// major·1,000,000 + minor·10,000 + patch·100 + the test number, or 99 for a release, so
// 1.3.0-test.2 (1030002) < 1.3.0 (1030099) < 1.3.1-test.1 (1030101). See version.sh's limits.
function versionCode(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-test\.(\d+))?$/.exec(version);
  if (!m)
    throw new Error(
      `FRONTEND_VERSION is not MAJOR.MINOR.PATCH[-test.N]: ${version}`,
    );
  const [major, minor, patch] = [m[1], m[2], m[3]].map(Number);
  return (
    major * 1000000 + minor * 10000 + patch * 100 + (m[4] ? Number(m[4]) : 99)
  );
}

module.exports = ({ config }) => {
  const version = process.env.FRONTEND_VERSION;
  if (!version) return config;
  return {
    ...config,
    version,
    android: { ...config.android, versionCode: versionCode(version) },
  };
};

module.exports.versionCode = versionCode;
