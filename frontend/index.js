// The app's entry. The notification handler and background tasks must be defined before the app
// loads: Android can start the JS with no app at all (swiped away). A dev server started with
// EXPO_PUBLIC_STORYBOOK=true shows Storybook instead (.rnstorybook/); in an APK that branch is
// empty — metro.config.js strips Storybook out.
if (process.env.EXPO_PUBLIC_STORYBOOK === 'true') {
  const { registerRootComponent } = require('expo');
  registerRootComponent(require('./.rnstorybook').default);
} else {
  require('./src/shared/device/notificationDisplay');
  require('./src/store/backgroundTasks');
  require('expo-router/entry');
}
