import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as pushService from '../../services/device/pushService';
import * as notificationsService from '../../services/http/notificationsService';

// Signed in, the browser allows notifications and they weren't turned off here (`optedOut`):
// make sure this browser has a subscription (no prompt — permission is already granted; the
// browser drops the subscription when the site is blocked, and allowing it again doesn't restore
// it) and that the server has it under the current user (it may have rotated, or belong to
// whoever signed in here before; the server upserts on endpoint). Resolves with whether this
// browser is subscribed.
async function ensureSubscribed(getState) {
  const { auth, notifications } = getState();
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

// Registers the service worker and reads this browser's state. Safe to re-run — the Account card
// does on mount, and watchNotificationPermission on every permission change.
export const initNotifications = createAsyncThunk(
  'notifications/init',
  async () => {
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

// Re-reads the browser's state, then syncs, whenever the site's permission changes while the app
// is open. A plain thunk: returns the stop function to the caller (an effect cleanup).
export const watchNotificationPermission = () => (dispatch) =>
  pushService.watchPermission(async () => {
    await dispatch(initNotifications());
    dispatch(syncPushSubscription());
  });

// ensureSubscribed — on start and sign-in (PushSubscriptionManager) and on a permission change.
// Background — failures are ignored.
export const syncPushSubscription = createAsyncThunk(
  'notifications/sync',
  async (_, { getState }) => ensureSubscribed(getState),
  {
    condition: (_, { getState }) => {
      const { auth, notifications } = getState();
      return !!auth.accessToken && notifications.permission === 'granted';
    },
  },
);

// Dispatch straight from a tap: requestPermission has to run inside the user gesture.
export const enableNotifications = createAsyncThunk(
  'notifications/enable',
  async (_, { getState, rejectWithValue }) => {
    const permission = await pushService.requestPermission();
    if (permission !== 'granted') return { permission, subscribed: false };
    try {
      const key = await notificationsService.getVapidPublicKey();
      const subscription = await pushService.subscribe(key);
      await notificationsService.saveSubscription(
        getState().auth.accessToken,
        subscription,
      );
      return { permission, subscribed: true };
    } catch (err) {
      return rejectWithValue(err?.message ?? String(err));
    }
  },
);

// This browser only, and it stays off here (`optedOut`). The server delete is best effort: if it
// fails, the push service answers 410 for the dropped subscription and the server deletes it then.
// `{ loggingOut: true }` also re-arms the after-login prompt, so the next person here is asked.
export const disableNotifications = createAsyncThunk(
  'notifications/disable',
  async (_options, { getState, rejectWithValue }) => {
    const subscription = await pushService.getSubscription().catch(() => null);
    if (!subscription) return;
    const token = getState().auth.accessToken;
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

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    permission: 'unsupported', // 'unsupported' | 'default' | 'granted' | 'denied'
    subscribed: false, // this browser has a push subscription
    ready: false, // initNotifications has run once
    busy: false, // enable/disable in flight
    error: null,
    promptDismissed: false, // persisted: the after-login prompt was answered on this browser
    optedOut: false, // persisted: turned off here (switch, "Not now" or log-out); blocks auto-subscribe
  },
  reducers: {
    dismissNotificationsPrompt(state) {
      state.promptDismissed = true;
    },
    // "Not now": also stays off here even if the browser allows notifications.
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
      .addCase(syncPushSubscription.fulfilled, (state, action) => {
        state.subscribed = action.payload;
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
        state.permission = pushService.getPermission();
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
