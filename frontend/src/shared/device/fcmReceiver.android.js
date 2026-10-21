import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { decrypt, show } from './fcmService';

// Runs for every FCM message — app open, in the background, or swiped away (Android starts the JS
// headless just for it) — so it's defined by the entry file (index.js) before the app loads.
// Not Redux: there may be no app. A message is `data = { v: '1', enc }` (see fcmService).
const TASK = 'fcm-notification';

// The payload's shape differs by app state (`data.enc`, `data.dataString`, …): find `enc` in it.
function findEnc(payload, depth = 0) {
  if (depth > 4 || payload == null) return null;
  if (typeof payload === 'string') {
    try {
      return findEnc(JSON.parse(payload), depth + 1);
    } catch {
      return null;
    }
  }
  if (typeof payload !== 'object') return null;
  if (payload.v === '1' && typeof payload.enc === 'string') return payload.enc;
  for (const value of Object.values(payload)) {
    const found = findEnc(value, depth + 1);
    if (found) return found;
  }
  return null;
}

TaskManager.defineTask(TASK, async ({ data }) => {
  const enc = findEnc(data);
  const content = enc && (await decrypt(enc));
  if (content && Date.parse(content.expiresAt) > Date.now()) {
    await show(content);
  }
  return Notifications.BackgroundNotificationTaskResult.NewData;
});

// Shown as a banner with the app open too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

Notifications.registerTaskAsync(TASK).catch(() => {});
