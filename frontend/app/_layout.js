import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppState, StatusBar } from 'react-native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import UpdateSheet from '../src/components/composite/UpdateSheet';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { persistor, store } from '../src/store';
import {
  checkForUpdate,
  deleteOldUpdates,
  listenForUpdates,
} from '../src/store/slices/appUpdateSlice';
import { clearAuth } from '../src/store/slices/authSlice';
import {
  initNotifications,
  syncPushSubscription,
  watchNotificationPermission,
} from '../src/store/slices/notificationsSlice';
import { syncLocation } from '../src/store/slices/profileSlice';
import {
  connectWebSocket,
  disconnectWebSocket,
} from '../src/store/slices/wsSlice';
import { isTokenExpired, msUntilExpiry } from '../src/utils/jwt';

// One WS connection app-wide, signed in or not (anonymous without a token); reconnects on sign-in/
// out. Closed while the app is in the background, opened again when it comes back.
function RealtimeConnectionManager() {
  const dispatch = useDispatch();
  const { accessToken } = useSelector((state) => state.auth);

  useEffect(() => {
    if (AppState.currentState !== 'background') dispatch(connectWebSocket());
  }, [accessToken, dispatch]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(connectWebSocket());
      else if (state === 'background') dispatch(disconnectWebSocket());
    });
    return () => sub.remove();
  }, [dispatch]);

  return null;
}

// Fresh GPS fix (not the cached one) while signed in → syncLocation; see docs/specs/services.md#frontend.
function LocationSyncManager() {
  const dispatch = useDispatch();
  const { accessToken } = useSelector((state) => state.auth);
  const { coords, status } = useSelector((state) => state.location);

  useEffect(() => {
    if (accessToken && coords && status === 'ready') dispatch(syncLocation());
  }, [accessToken, coords, status, dispatch]);

  return null;
}

// Registers the service worker at start; while signed in, re-sends this browser's push subscription
// (it may have rotated, or belong to whoever signed in here before) — see notificationsSlice.
function PushSubscriptionManager() {
  const dispatch = useDispatch();
  const { accessToken } = useSelector((state) => state.auth);
  const ready = useSelector((state) => state.notifications.ready);

  useEffect(() => {
    dispatch(initNotifications());
    return dispatch(watchNotificationPermission());
  }, [dispatch]);

  useEffect(() => {
    if (accessToken && ready) dispatch(syncPushSubscription());
  }, [accessToken, ready, dispatch]);

  return null;
}

// The APK checks for a newer version on start, whenever it comes back to the foreground, and when
// Gateway announces one over /ws (`app-update`); it clears update files it no longer needs on
// start. appUpdateSlice skips this everywhere else. UpdateSheet is app-wide, so it opens over any
// tab.
function AppUpdateManager() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(deleteOldUpdates());
    dispatch(checkForUpdate());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(checkForUpdate());
    });
    const stopListening = dispatch(listenForUpdates());
    return () => {
      sub.remove();
      stopListening();
    };
  }, [dispatch]);

  return <UpdateSheet />;
}

// Login is optional app-wide (see CLAUDE.md) — clears an expired session on a timer and keeps a
// logged-in visitor out of (auth).
function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch();
  const { accessToken, notice } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!accessToken) return;
    if (isTokenExpired(accessToken)) {
      dispatch(clearAuth());
      return;
    }
    const timer = setTimeout(
      () => dispatch(clearAuth()),
      msUntilExpiry(accessToken),
    );
    return () => clearTimeout(timer);
  }, [accessToken, dispatch]);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const hasValidSession = !!accessToken && !isTokenExpired(accessToken);
    if (hasValidSession && inAuthGroup) {
      router.replace('/');
    }
  }, [accessToken, segments, router]);

  // The server ended the session: take the user to login once, where the notice says why. Only
  // when the notice appears — leaving login (Back, "Continue without logging in") isn't undone.
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  useEffect(() => {
    if (notice && segmentsRef.current[0] !== '(auth)') router.push('/login');
  }, [notice, router]);

  return null;
}

// Status-bar icons follow the app's theme, not the phone's — light icons on a light page vanish.
function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <ThemedStatusBar />
        <AuthGate />
        <RealtimeConnectionManager />
        <LocationSyncManager />
        <PushSubscriptionManager />
        <Stack screenOptions={{ headerShown: false }} />
        <AppUpdateManager />
      </PersistGate>
    </Provider>
  );
}
