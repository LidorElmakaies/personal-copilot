import SettingsScreen from './SettingsScreen';

export default {
  component: SettingsScreen,
  parameters: { layout: 'fullscreen', language: 'en' },
};

// The app's real language and theme: a tap here changes them, as in the app.
export const Default = {};

// Its words in Hebrew; the pick shown is still the app's own.
export const Hebrew = { parameters: { language: 'he' } };
