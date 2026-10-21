import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as fcmService from './fcmService';
import * as pushService from './pushService';
import * as notificationsService from './notificationsService';

// Two ways in, one state: the web build registers a browser (Web Push, pushService); the Android
// app registers the phone (FCM, fcmService). "subscribed" = this browser has a push subscription /
// this phone has its device key. The screens don't care which.
const android = fcmService.isSupported();

// Signed in, notifications are allowed and they weren't turned off here (`optedOut`): make sure
// this browser or phone is registered (no prompt — permission is already granted; the browser
// drops its subscription when the site is blocked, and allowing it again doesn't restore it) and
// that the server has it under the current user (it may have rotated, or belong to whoever signed
// in here before; the server upserts). Resolves with whether it's registered.
async function ensureSubscribed(getState) {
  const { auth, notifications } = getState();
  if (android) {
    const registered = await fcmService.isRegistered();
    if (!auth.accessToken) return registered;
    if (!registered && notifications.optedOut) return false;
    const device = await fcmService.register();
    await notificationsService
      .saveFcmDevice(auth.accessToken, device)
      .catch(() => {}); // re-sent on the next start anyway
    return true;
  }
  let subscription = await pushService.getSubscription();
  if (!auth.accessToken) return !!subscription;
  if (!subscription) {
    if (notifications.optedOut) return false;
    const key = await notificationsService.getVapidPublicKey();
    subscription = await pushService.subscribe(key);
  }
  await notificationsService
    .saveSubscription(auth.accessToken, subscription)
    .catch(() => {}); // re-sent on the next start anyway
  return true;
}

// Registers the service worker (web) or the notification channel (Android) and reads this
// device's state. Safe to re-run — the Account card does on mount, and
// watchNotificationPermission on every permission change.
export const initNotifications = createAsyncThunk(
  'notifications/init',
  async () => {
    if (android) {
      try {
        await fcmService.init();
        const permission = await fcmService.getPermission();
        return {
          permission,
          subscribed:
            permission === 'granted' && (await fcmService.isRegistered()),
        };
      } catch {
        return { permission: 'unsupported', subscribed: false };
      }
    }
    try {
      await pushService.registerServiceWorker();
      const permission = pushService.getPermission();
      if (permission !== 'granted') return { permission, subscribed: false };
      return {
        permission,
        subscribed: !!(await pushService.getSubscription()),
      };
    } catch {
      return { permission: pushService.getPermission(), subscribed: false };
    }
  },
);

// Re-reads the state, then syncs, whenever the permission changes while the app is open (Android:
// on coming back from its settings) — and on Android whenever Google replaces the FCM token. A
// plain thunk: returns the stop function to the caller (an effect cleanup).
export const watchNotificationPermission = () => (dispatch) => {
  const resync = async () => {
    await dispatch(initNotifications());
    dispatch(syncPushSubscription());
  };
  if (android) {
    const stopPermission = fcmService.watchPermission(resync);
    const stopToken = fcmService.watchToken(() =>
      dispatch(syncPushSubscription()),
    );
    return () => {
      stopPermission();
      stopToken();
    };
  }
  return pushService.watchPermission(resync);
};

// ensureSubscribed — on start and sign-in (PushSubscriptionManager) and on a permission change.
// Background — failures are ignored.
export const syncPushSubscription = createAsyncThunk(
  'notifications/sync',
  async (_, { getState }) => ensureSubscribed(getState),
  {
    // One at a time: a sync asked for while one runs adds nothing.
    condition: (_, { getState }) => {
      const { auth, notifications } = getState();
      return (
        !!auth.accessToken &&
        notifications.permission === 'granted' &&
        !notifications.syncing
      );
    },
  },
);

// Dispatch straight from a tap: a browser's requestPermission has to run inside the user gesture.
export const enableNotifications = createAsyncThunk(
  'notifications/enable',
  async (_, { getState, rejectWithValue }) => {
    const permission = android
      ? await fcmService.requestPermission()
      : await pushService.requestPermission();
    if (permission !== 'granted') return { permission, subscribed: false };
    try {
      const token = getState().auth.accessToken;
      if (android) {
        await notificationsService.saveFcmDevice(
          token,
          await fcmService.register(),
        );
      } else {
        const key = await notificationsService.getVapidPublicKey();
        await notificationsService.saveSubscription(
          token,
          await pushService.subscribe(key),
        );
      }
      return { permission, subscribed: true };
    } catch (err) {
      return rejectWithValue(err?.message ?? String(err));
    }
  },
);

// This browser or phone only, and it stays off here (`optedOut`). The server delete is best
// effort: if it fails, the push service / FCM answers "gone" for the dropped registration and the
// server deletes it then. `{ loggingOut: true }` also re-arms the after-login prompt, so the next
// person here is asked.
export const disableNotifications = createAsyncThunk(
  'notifications/disable',
  async (_options, { getState, rejectWithValue }) => {
    const token = getState().auth.accessToken;
    if (android) {
      if (!(await fcmService.isRegistered().catch(() => false))) return;
      const fcmToken = await fcmService.getToken().catch(() => null);
      if (token && fcmToken) {
        await notificationsService
          .deleteFcmDevice(token, fcmToken)
          .catch(() => {});
      }
      try {
        await fcmService.unregister();
      } catch (err) {
        return rejectWithValue(err?.message ?? String(err));
      }
      return;
    }
    const subscription = await pushService.getSubscription().catch(() => null);
    if (!subscription) return;
    if (token) {
      await notificationsService
        .deleteSubscription(token, subscription.endpoint)
        .catch(() => {});
    }
    try {
      await pushService.unsubscribe();
    } catch (err) {
      return rejectWithValue(err?.message ?? String(err));
    }
  },
);

// Android only: the app's page in Android's settings, where blocked notifications are allowed again.
export const openNotificationSettings = createAsyncThunk(
  'notifications/openSettings',
  async () => {
    await fcmService.openSettings();
  },
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    platform: android ? 'android' : 'web', // which wording the screens use
    permission: 'unsupported', // 'unsupported' | 'default' | 'granted' | 'denied'
    subscribed: false, // this browser has a push subscription / this phone has its device key
    ready: false, // initNotifications has run once
    busy: false, // enable/disable in flight
    syncing: false, // syncPushSubscription in flight
    error: null,
    promptDismissed: false, // persisted: the after-login prompt was answered on this device
    optedOut: false, // persisted: turned off here (switch, "Not now" or log-out); blocks auto-subscribe
  },
  reducers: {
    dismissNotificationsPrompt(state) {
      state.promptDismissed = true;
    },
    // "Not now": also stays off here even if notifications are allowed.
    declineNotificationsPrompt(state) {
      state.promptDismissed = true;
      state.optedOut = true;
    },
  },
  extraReducers: (builder) => {
    const applyState = (state, action) => {
      state.permission = action.payload.permission;
      state.subscribed = action.payload.subscribed;
    };
    builder
      .addCase(initNotifications.fulfilled, (state, action) => {
        applyState(state, action);
        state.ready = true;
        state.error = null; // an old error, e.g. from the last user's log-out, doesn't carry over
      })
      .addCase(syncPushSubscription.pending, (state) => {
        state.syncing = true;
      })
      .addCase(syncPushSubscription.fulfilled, (state, action) => {
        state.syncing = false;
        state.subscribed = action.payload;
      })
      .addCase(syncPushSubscription.rejected, (state) => {
        state.syncing = false;
      })
      .addCase(enableNotifications.pending, (state) => {
        state.busy = true;
        state.error = null;
      })
      .addCase(enableNotifications.fulfilled, (state, action) => {
        state.busy = false;
        applyState(state, action);
        if (state.subscribed) state.optedOut = false;
      })
      .addCase(enableNotifications.rejected, (state, action) => {
        state.busy = false;
        if (!android) state.permission = pushService.getPermission();
        state.error = action.payload ?? action.error.message;
      })
      .addCase(disableNotifications.pending, (state) => {
        state.busy = true;
        state.error = null;
      })
      .addCase(disableNotifications.fulfilled, (state, action) => {
        state.busy = false;
        state.subscribed = false;
        state.optedOut = true;
        if (action.meta.arg?.loggingOut) state.promptDismissed = false;
      })
      .addCase(disableNotifications.rejected, (state, action) => {
        state.busy = false;
        state.error = action.payload ?? action.error.message;
      });
  },
});

export const { dismissNotificationsPrompt, declineNotificationsPrompt } =
  notificationsSlice.actions;
export default notificationsSlice.reducer;
