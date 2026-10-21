import * as appStateService from '../../../shared/device/appStateService';
import * as localNotifications from '../../../shared/device/localNotificationsService';
import { planFor } from '../utils/schedulePlan';

// The phone's own reminder notifications (exact alarms): makes what's scheduled match
// schedulePlan's plan for the current state — cancels ours no longer wanted or changed, schedules
// the missing. Run after every reminder change, on start (alarms due while the phone was off are
// dropped, not re-created), on return to the foreground and when the location changes
// (ReminderScheduleManager). Nothing on the web build.

const same = (a, b) =>
  a.at === b.at && a.title === b.title && a.body === b.body && a.url === b.url;

async function reconcileOnce(getState) {
  await localNotifications.ensureChannel();
  const desired = planFor(getState(), new Date());
  const scheduled = await localNotifications.listScheduled();
  const wanted = new Map(desired.map((n) => [n.id, n]));
  const have = new Map();
  for (const n of scheduled) {
    const want = wanted.get(n.id);
    if (want && same(want, n)) {
      have.set(n.id, n);
      continue;
    }
    await localNotifications.cancel(n.id).catch(warn('cancel', n.id));
  }
  for (const n of desired) {
    if (have.has(n.id)) continue;
    await localNotifications.schedule(n).catch(warn('schedule', n.id));
  }
}

const warn = (what, id) => (err) =>
  console.warn(`Couldn't ${what} notification ${id}: ${err?.message ?? err}`);

// One run at a time: asked for while one runs, it runs once more afterwards (with the state as it
// is then). Never rejects — a failure is logged, and the next trigger tries again.
let running = null;
let again = false;

export const reconcileReminderNotifications = () => (_dispatch, getState) => {
  if (!localNotifications.isSupported()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        try {
          await reconcileOnce(getState);
        } catch (err) {
          console.warn(
            `Couldn't schedule reminder notifications: ${err?.message ?? err}`,
          );
        }
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
};

// Reconciles again whenever the app comes back to the foreground. A plain thunk: returns the stop
// function to the caller (an effect cleanup).
export const watchForegroundReconcile = () => (dispatch) =>
  appStateService.watchForeground(() =>
    dispatch(reconcileReminderNotifications()),
  );

// `onUrl(url)` for a tap on a notification carrying a url (the one that opened the app, then each
// one while it runs). Returns the stop function.
export const watchNotificationTaps = (onUrl) => () =>
  localNotifications.watchTaps(onUrl);
