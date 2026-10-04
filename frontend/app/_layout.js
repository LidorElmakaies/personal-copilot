import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeAnimProvider } from '../src/context/ThemeAnimContext';
import { persistor, store } from '../src/store';
import { clearAuth } from '../src/store/slices/authSlice';
import { syncLocation } from '../src/store/slices/profileSlice';
import {
  connectWebSocket,
  disconnectWebSocket,
} from '../src/store/slices/wsSlice';
import { isTokenExpired, msUntilExpiry } from '../src/utils/jwt';

// Connects/disconnects the WS as soon as a token becomes available/unavailable — app-wide.
function RealtimeConnectionManager() {
  const dispatch = useDispatch();
  const { accessToken } = useSelector((state) => state.auth);

  useEffect(() => {
    if (accessToken) {
      dispatch(connectWebSocket());
    } else {
      dispatch(disconnectWebSocket());
    }
  }, [accessToken, dispatch]);

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

// Login is optional app-wide (see CLAUDE.md) — clears an expired session on a timer and keeps a
// logged-in visitor out of (auth).
function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch();
  const { accessToken } = useSelector((state) => state.auth);

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

  return null;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <ThemeAnimProvider>
          <AuthGate />
          <RealtimeConnectionManager />
          <LocationSyncManager />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeAnimProvider>
      </PersistGate>
    </Provider>
  );
}
