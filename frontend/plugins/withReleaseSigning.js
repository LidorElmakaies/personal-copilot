const { withAppBuildGradle } = require('expo/config-plugins');

// Signs the release APK with the project's own key instead of the debug one the generated
// android/app/build.gradle uses. Gradle reads the key from env vars that only
// `node devops/android/apk.js build` sets (the keystore lives in devops/data/android/, never in git);
// without them the release signing config stays empty and only a debug build works.
const RELEASE_SIGNING = `
        release {
            if (System.getenv('PC_KEYSTORE_FILE')) {
                storeFile file(System.getenv('PC_KEYSTORE_FILE'))
                storePassword System.getenv('PC_KEYSTORE_PASSWORD')
                keyAlias System.getenv('PC_KEY_ALIAS')
                keyPassword System.getenv('PC_KEYSTORE_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (!gradle.includes("System.getenv('PC_KEYSTORE_FILE')")) {
      const signingConfigs = /signingConfigs\s*\{/;
      const releaseUsesDebug =
        /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
      // Fail the build loudly if Expo's template changes shape, rather than ship a debug-signed APK.
      if (!signingConfigs.test(gradle) || !releaseUsesDebug.test(gradle)) {
        throw new Error(
          'withReleaseSigning: unexpected android/app/build.gradle layout',
        );
      }
      gradle = gradle
        .replace(signingConfigs, (m) => m + RELEASE_SIGNING)
        .replace(releaseUsesDebug, '$1signingConfig signingConfigs.release');
    }
    mod.modResults.contents = gradle;
    return mod;
  });
};
