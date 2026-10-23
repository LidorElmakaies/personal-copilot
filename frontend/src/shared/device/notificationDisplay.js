import * as Notifications from 'expo-notifications';

// Loaded by the entry file (index.js): a reminder that goes off with the app open shows as a
// banner too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
