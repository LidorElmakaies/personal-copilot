// Extends app.json with what changes per build: the version and Android's versionCode, from
// FRONTEND_VERSION (set by `node devops/android/apk.js build` from version/versions.json). Unset —
// a dev server — app.json is used as is.
//
// APP_VARIANT=dev (`apk.js build --dev`) makes the dev build: its own app id, name and link scheme,
// so it installs next to the real app; it loads the app's code from `npx expo start` on the PC.
const { versionCode } = require('./src/shared/utils/versionCode');

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT === 'dev') {
    config = {
      ...config,
      name: 'Personal Copilot Dev',
      scheme: 'personalcopilotdev',
      android: { ...config.android, package: 'com.lidor.personalcopilot.dev' },
    };
  }
  const version = process.env.FRONTEND_VERSION;
  if (!version) return config;
  return {
    ...config,
    version,
    android: {
      ...config.android,
      versionCode: versionCode(version),
    },
  };
};
