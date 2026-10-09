// Extends app.json with what changes per build: the version and Android's versionCode, from
// FRONTEND_VERSION (set by `node devops/android/apk.js build` from version/versions.json). Unset —
// the web build, a dev server — app.json is used as is.
const { versionCode } = require('./src/utils/versionCode');

module.exports = ({ config }) => {
  const version = process.env.FRONTEND_VERSION;
  if (!version) return config;
  return {
    ...config,
    version,
    android: { ...config.android, versionCode: versionCode(version) },
  };
};
