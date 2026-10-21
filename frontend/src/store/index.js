import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';
import {
  adminReducer,
  authReducer,
  profileReducer,
  refreshSession,
  selectUserId,
} from '../features/account';
import { appUpdateReducer } from '../features/app-update';
import { calendarReducer } from '../features/calendar';
import { customRemindersReducer } from '../features/reminders';
import { remindersReducer } from '../features/shabbat';
import locationReducer from '../shared/device/locationSlice';
import notificationsReducer from '../shared/device/notificationsSlice';
import { setUnauthorizedHandler } from '../shared/http/httpClient';
import wsReducer from '../shared/realtime/wsSlice';
import themeReducer from '../shared/theme/themeSlice';
import { getUserFromToken } from '../shared/utils/jwt';

// The root store: each feature's reducer (from its index.js) and shared/'s, with what persists.
// Not in shared/ — it imports every feature.

const themePersistConfig = {
  key: 'theme',
  storage: AsyncStorage,
};

const locationPersistConfig = {
  key: 'location',
  storage: AsyncStorage,
  whitelist: ['coords'], // last known location survives a reload; status doesn't
};

const calendarPersistConfig = {
  key: 'calendar',
  storage: AsyncStorage,
  whitelist: ['shabbat'],
};

const notificationsPersistConfig = {
  key: 'notifications',
  storage: AsyncStorage,
  whitelist: ['promptDismissed', 'optedOut'], // the rest is read from the browser on every start
};

const appUpdatePersistConfig = {
  key: 'appUpdate',
  storage: AsyncStorage,
  whitelist: ['dismissedVersionCode'], // the release itself is re-read on every start
};

const wsPersistConfig = {
  key: 'ws',
  storage: AsyncStorage,
  whitelist: ['deviceToken'], // this install's /ws identity, kept across restarts and sign-outs
};

const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  blacklist: ['status', 'error', 'notice'], // ephemeral per-submission state
};

export const store = configureStore({
  reducer: {
    theme: persistReducer(themePersistConfig, themeReducer),
    auth: persistReducer(authPersistConfig, authReducer),
    ws: persistReducer(wsPersistConfig, wsReducer),
    location: persistReducer(locationPersistConfig, locationReducer),
    calendar: persistReducer(calendarPersistConfig, calendarReducer),
    profile: profileReducer, // not persisted — fetched when needed (profileSlice)
    reminders: remindersReducer, // not persisted — fetched on sign-in (CandleReminder)
    customReminders: customRemindersReducer, // not persisted — the Calendar tab's months
    admin: adminReducer, // not persisted — fetched when the Admin tab opens
    notifications: persistReducer(
      notificationsPersistConfig,
      notificationsReducer,
    ),
    appUpdate: persistReducer(appUpdatePersistConfig, appUpdateReducer),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

// A 401 for the current token renews it (refreshSession signs out if the server refuses); one for
// an older token is retried with its replacement — only the same user's, never the next one's.
setUnauthorizedHandler((token) => {
  const state = store.getState();
  if (state.auth.accessToken === token) return store.dispatch(refreshSession());
  const sameUser = getUserFromToken(token)?.id === selectUserId(state);
  return Promise.resolve(sameUser ? state.auth.accessToken : null);
});
