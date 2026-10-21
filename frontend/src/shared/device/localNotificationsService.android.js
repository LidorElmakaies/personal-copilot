import * as Notifications from 'expo-notifications';

// Notifications the phone schedules itself (exact alarms, expo-notifications), no Redux knowledge
// — called only from thunks (the reminders' reconcile) and by fcmService for the channel. The web
// build gets localNotificationsService.js, which does nothing.
//
// Ours are told apart from anything else scheduled by their id's prefix (ID_PREFIX — schedulePlan
// builds the ids with it); their time is kept in data (`at`).
export const CHANNEL_ID = 'reminders';
export const ID_PREFIX = 'rem:';

export function isSupported() {
  return true;
}

// The channel every reminder is shown in (Android settings lists it). Safe to repeat.
export async function ensureChannel() {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// One exact alarm at `at` (ms). The same id replaces an earlier one.
export async function schedule({ id, at, title, body, url }) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, data: { url, at } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancel(id) {
  await Notifications.cancelScheduledNotificationAsync(id);
}

// Ours still pending: [{ id, at, title, body, url }].
export async function listScheduled() {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  return requests
    .filter((r) => r.identifier?.startsWith(ID_PREFIX))
    .map((r) => ({
      id: r.identifier,
      at: Number(r.content.data?.at) || null,
      title: r.content.title ?? null,
      body: r.content.body ?? null,
      url: r.content.data?.url ?? null,
    }));
}

// Taps on any notification (ours or a pushed one) that carries `data.url`: `onUrl(url)` for the
// tap that opened the app, if any, then for each tap while it runs. Returns a function that stops.
export function watchTaps(onUrl) {
  const handle = (response) => {
    const url = response?.notification?.request?.content?.data?.url;
    if (typeof url === 'string' && url) onUrl(url);
  };
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    Notifications.clearLastNotificationResponse(); // not again on the next mount
    handle(last);
  }
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    Notifications.clearLastNotificationResponse();
    handle(r);
  });
  return () => sub.remove();
}
