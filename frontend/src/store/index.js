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
import { setUnauthorizedHandler } from '../services/http/httpClient';
import adminReducer from './slices/adminSlice';
import appUpdateReducer from './slices/appUpdateSlice';
import authReducer, {
  clearAuth,
  SESSION_ENDED_NOTICE,
} from './slices/authSlice';
import calendarReducer from './slices/calendarSlice';
import locationReducer from './slices/locationSlice';
import notificationsReducer from './slices/notificationsSlice';
import profileReducer from './slices/profileSlice';
import remindersReducer from './slices/remindersSlice';
import themeReducer from './slices/themeSlice';
import wsReducer from './slices/wsSlice';

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

// Current token only: a late 401 for an older token mustn't sign out its replacement.
setUnauthorizedHandler((token) => {
  if (store.getState().auth.accessToken === token) {
    store.dispatch(clearAuth({ notice: SESSION_ENDED_NOTICE }));
  }
});
