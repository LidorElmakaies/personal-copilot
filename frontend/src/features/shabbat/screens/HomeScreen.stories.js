import HomeScreen from './HomeScreen';

export default {
  component: HomeScreen,
  parameters: { layout: 'fullscreen' },
};

// The app's real state (location, saved reminders), as on its tab.
export const Default = {};

export const Hebrew = { parameters: { language: 'he' } };
