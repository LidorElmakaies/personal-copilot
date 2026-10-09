import { Platform } from 'react-native';

// Browser Web Push I/O, no Redux knowledge — called only from notificationsSlice's thunks. Web
// build only; everything reports 'unsupported' elsewhere.
const SW_URL = '/sw.js';

function isSupported() {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// 'unsupported' | 'default' | 'granted' | 'denied'
export function getPermission() {
  return isSupported() ? Notification.permission : 'unsupported';
}

export async function registerServiceWorker() {
  if (!isSupported()) return;
  await navigator.serviceWorker.register(SW_URL, { scope: '/' });
}

// Calls onChange when the user changes this site's notification permission in the browser's
// settings while the app is open. Returns a function that stops watching.
export function watchPermission(onChange) {
  if (!isSupported() || !navigator.permissions?.query) return () => {};
  let status;
  let stopped = false;
  navigator.permissions
    .query({ name: 'notifications' })
    .then((s) => {
      if (stopped) return;
      status = s;
      status.onchange = onChange;
    })
    .catch(() => {});
  return () => {
    stopped = true;
    if (status) status.onchange = null;
  };
}

// Must be the first await of a tap handler — browsers only show the prompt during a user gesture.
export function requestPermission() {
  return Notification.requestPermission();
}

// This browser's current subscription as PushSubscription.toJSON() (what the server stores), or null.
export async function getSubscription() {
  if (!isSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? subscription.toJSON() : null;
}

export async function subscribe(vapidPublicKey) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(vapidPublicKey),
  });
  return subscription.toJSON();
}

export async function unsubscribe() {
  if (!isSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}

function base64UrlToBytes(value) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
