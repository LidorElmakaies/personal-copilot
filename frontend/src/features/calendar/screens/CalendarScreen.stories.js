import CalendarScreen from './CalendarScreen';

export default {
  component: CalendarScreen,
  parameters: { layout: 'fullscreen', language: 'en' },
};

// The app's real state (location, saved reminders), as on its tab.
export const Default = {};

export const Hebrew = { parameters: { language: 'he' } };
