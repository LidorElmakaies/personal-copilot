// Extends app.json with what changes per build: the version and Android's versionCode, from
// FRONTEND_VERSION (set by `node devops/android/apk.js build` from version/versions.json). Unset —
// the web build, a dev server — app.json is used as is. google-services.json (Firebase, for push) is
// copied in by the build only when devops/data/android/ has one.
const fs = require('fs');
const path = require('path');
const { versionCode } = require('./src/utils/versionCode');

module.exports = ({ config }) => {
  const version = process.env.FRONTEND_VERSION;
  if (!version) return config;
  const firebase = fs.existsSync(path.join(__dirname, 'google-services.json'));
  return {
    ...config,
    version,
    android: {
      ...config.android,
      versionCode: versionCode(version),
      ...(firebase && { googleServicesFile: './google-services.json' }),
    },
  };
};
