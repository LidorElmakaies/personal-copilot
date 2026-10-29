// Expo's Metro config, wrapped by Storybook's. Storybook is in the bundle only when the dev server
// runs with EXPO_PUBLIC_STORYBOOK=true (docs/frontend/environment.md, "Storybook"); otherwise —
// every APK — each of its imports resolves to an empty module. The lite UI needs no native module.
const { getDefaultConfig } = require('expo/metro-config');
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');

process.env.STORYBOOK_DISABLE_TELEMETRY ??= 'true';

module.exports = withStorybook(getDefaultConfig(__dirname), {
  enabled: process.env.EXPO_PUBLIC_STORYBOOK === 'true',
  liteMode: true,
  useJs: true,
});
