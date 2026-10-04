import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as pushService from '../../services/device/pushService';
import * as notificationsService from '../../services/http/notificationsService';

// Registers the service worker and reads this browser's state. Safe to re-run — the Account card
// does on mount, to pick up a permission changed in the browser's settings meanwhile.
export const initNotifications = createAsyncThunk(
  'notifications/init',
  async () => {
    try {
      await pushService.registerServiceWorker();
      const permission = pushService.getPermission();
      const subscription =
        permission === 'granted' ? await pushService.getSubscription() : null;
      return { permission, subscribed: !!subscription };
    } catch {
      return { permission: 'unsupported', subscribed: false };
    }
  },
);

// On sign-in and app start: re-sends this browser's subscription, so the server has the current
// one (the browser may have rotated it) under the current user. Background — failures are ignored.
export const syncPushSubscription = createAsyncThunk(
  'notifications/sync',
  async (_, { getState }) => {
    const subscription = await pushService.getSubscription();
    if (!subscription) return false;
    await notificationsService.saveSubscription(
      getState().auth.accessToken,
      subscription,
    );
    return true;
  },
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

// This browser only. The server delete is best effort: if it fails, the push service answers 410
// for the dropped subscription and the server deletes it then.
export const disableNotifications = createAsyncThunk(
  'notifications/disable',
  async (_, { getState, rejectWithValue }) => {
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
  },
  reducers: {
    dismissNotificationsPrompt(state) {
      state.promptDismissed = true;
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
      .addCase(disableNotifications.fulfilled, (state) => {
        state.busy = false;
        state.subscribed = false;
      })
      .addCase(disableNotifications.rejected, (state, action) => {
        state.busy = false;
        state.error = action.payload ?? action.error.message;
      });
  },
});

export const { dismissNotificationsPrompt } = notificationsSlice.actions;
export default notificationsSlice.reducer;
