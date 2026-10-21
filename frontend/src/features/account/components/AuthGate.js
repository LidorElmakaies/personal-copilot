import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { isTokenExpired, msUntilExpiry } from '../../../shared/utils/jwt';
import {
  RENEW_BEFORE_EXPIRY_MS,
  RENEW_RETRY_MS,
  renewSessionIfDue,
} from '../store/authSlice';

// Login is optional app-wide (see CLAUDE.md) — renews the session a minute before it expires
// (at once if it already has, e.g. on start) and keeps a logged-in visitor out of (auth).
export default function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch();
  const { accessToken, notice } = useSelector((state) => state.auth);

  // A renewal or sign-out changes accessToken and restarts this; one the server didn't answer
  // (offline) leaves it, so it's tried again later.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    let timer;
    const renew = async () => {
      const renewed = await dispatch(renewSessionIfDue());
      if (!renewed && !cancelled) timer = setTimeout(renew, RENEW_RETRY_MS);
    };
    timer = setTimeout(
      renew,
      Math.max(0, msUntilExpiry(accessToken) - RENEW_BEFORE_EXPIRY_MS),
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessToken, dispatch]);

  // Timers don't run while a phone app is in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(renewSessionIfDue());
    });
    return () => sub.remove();
  }, [dispatch]);

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
