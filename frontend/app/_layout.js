import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeAnimProvider } from '../src/context/ThemeAnimContext';
import { persistor, store } from '../src/store';
import { clearAuth } from '../src/store/slices/authSlice';
import { connectWebSocket, disconnectWebSocket } from '../src/store/slices/wsSlice';
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

// Gates the (tabs) screens behind a valid, non-expired session.
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
    const timer = setTimeout(() => dispatch(clearAuth()), msUntilExpiry(accessToken));
    return () => clearTimeout(timer);
  }, [accessToken, dispatch]);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const hasValidSession = !!accessToken && !isTokenExpired(accessToken);
    if (!hasValidSession && !inAuthGroup) {
      router.replace('/login');
    } else if (hasValidSession && inAuthGroup) {
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
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeAnimProvider>
      </PersistGate>
    </Provider>
  );
}
