import NotificationsPrompt from './NotificationsPrompt';

// The one-time prompt as a first reminder brings it up; its buttons do nothing here (no Android
// permission prompt).
const state = {
  notifications: { ready: true, permission: 'default', promptDismissed: false },
  reminders: { candles: { enabled: true } },
};

export default {
  component: NotificationsPrompt,
  parameters: { state, language: 'en' },
};

export const English = {};
export const Hebrew = { parameters: { state, language: 'he' } };
