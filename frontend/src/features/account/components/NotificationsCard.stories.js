import NotificationsCard from './NotificationsCard';

// Blocked in Android's settings: the warning and its link (which do nothing here).
const state = {
  notifications: { permission: 'denied', ready: true, busy: false },
};

export default {
  component: NotificationsCard,
  parameters: { state, language: 'en' },
};

export const Blocked = {};
export const BlockedHebrew = { parameters: { state, language: 'he' } };
