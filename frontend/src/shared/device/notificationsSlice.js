import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as appStateService from './appStateService';
import * as localNotifications from './localNotificationsService';

// Whether this phone may show the reminders it schedules (localNotificationsService): Android's
// notification permission — nothing to register anywhere else. "Off" is Android's own setting.

// Makes the `reminders` channel and reads the permission. Safe to re-run — on start, on return
// to the foreground (watchNotificationPermission) and when the Account card mounts.
export const initNotifications = createAsyncThunk(
  'notifications/init',
  async () => {
    if (!localNotifications.isSupported()) return 'unsupported';
    try {
      await localNotifications.ensureChannel();
      return await localNotifications.getPermission();
    } catch {
      return 'unsupported';
    }
  },
);

// The permission is changed in Android's settings, outside the app: re-read it whenever the app
// comes back to the foreground. A plain thunk: returns the stop function to the caller (an effect
// cleanup).
export const watchNotificationPermission = () => (dispatch) =>
  appStateService.watchForeground(() => dispatch(initNotifications()));

// Android's own "Allow notifications?" — asked from a tap (Turn on).
export const enableNotifications = createAsyncThunk(
  'notifications/enable',
  async () => localNotifications.requestPermission(),
);

// Once Android won't ask again ('denied'): the app's page in its settings.
export const openNotificationSettings = createAsyncThunk(
  'notifications/openSettings',
  async () => {
    await localNotifications.openSettings();
  },
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    permission: 'unsupported', // 'unsupported' | 'default' | 'granted' | 'denied'
    ready: false, // initNotifications has run once
    busy: false, // Android's prompt is open
    promptDismissed: false, // persisted: the "Turn on notifications?" prompt was answered here
  },
  reducers: {
    // Either answer to the prompt ("Turn on" or "Not now"); the Account card is the way back.
    dismissNotificationsPrompt(state) {
      state.promptDismissed = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initNotifications.fulfilled, (state, action) => {
        state.permission = action.payload;
        state.ready = true;
      })
      .addCase(enableNotifications.pending, (state) => {
        state.busy = true;
      })
      .addCase(enableNotifications.fulfilled, (state, action) => {
        state.busy = false;
        state.permission = action.payload;
      })
      .addCase(enableNotifications.rejected, (state) => {
        state.busy = false;
      });
  },
});

export const { dismissNotificationsPrompt } = notificationsSlice.actions;
export default notificationsSlice.reducer;
