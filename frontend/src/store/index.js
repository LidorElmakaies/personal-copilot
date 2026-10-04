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
import authReducer from './slices/authSlice';
import calendarReducer from './slices/calendarSlice';
import locationReducer from './slices/locationSlice';
import profileReducer from './slices/profileSlice';
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

const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  blacklist: ['status', 'error'], // ephemeral per-submission state
};

export const store = configureStore({
  reducer: {
    theme: persistReducer(themePersistConfig, themeReducer),
    auth: persistReducer(authPersistConfig, authReducer),
    ws: wsReducer, // ephemeral — connection status shouldn't survive a reload
    location: persistReducer(locationPersistConfig, locationReducer),
    calendar: persistReducer(calendarPersistConfig, calendarReducer),
    profile: profileReducer, // not persisted — fetched when needed (profileSlice)
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
