import { gcm } from '@noble/ciphers/aes.js';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { AppState, Linking } from 'react-native';
import { CHANNEL_ID, ensureChannel } from './localNotificationsService';

// The Android app's push I/O (FCM), no Redux knowledge — called only from notificationsSlice's
// thunks, and by fcmReceiver for incoming messages. The web build gets fcmService.js instead.
//
// "Registered" = this phone has its 256-bit key (made on Turn on, deleted on off / Log Out). The
// key and the FCM token go to the server together (PUT /notifications/fcm-devices); every
// notification arrives encrypted with the key — see docs/specs/services.md#notifications.
const KEY_ITEM = 'fcmDeviceKey';

export function isSupported() {
  return true;
}

// The channel every reminder is shown in — localNotificationsService owns it. Safe to repeat.
export async function init() {
  await ensureChannel();
}

// 'default' | 'granted' | 'denied' — 'denied' only once Android won't ask again (Android 13+
// asks twice at most; below 13 notifications are allowed unless turned off in settings).
const toPermission = ({ status, canAskAgain }) =>
  status === 'granted' ? 'granted' : canAskAgain ? 'default' : 'denied';

export async function getPermission() {
  return toPermission(await Notifications.getPermissionsAsync());
}

export async function requestPermission() {
  return toPermission(await Notifications.requestPermissionsAsync());
}

// Notification permission is changed in Android's settings, outside the app: re-read it whenever
// the app comes back to the foreground. Returns a function that stops watching.
export function watchPermission(onChange) {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') onChange();
  });
  return () => sub.remove();
}

// The token this app last fetched or was told about.
let lastToken = null;

// Google may replace the token (rare); the new one has to reach the server. expo-notifications
// also fires this on every getDevicePushTokenAsync, same token or not — only a different one
// counts, or re-sending it would fire it again, endlessly.
export function watchToken(onChange) {
  const sub = Notifications.addPushTokenListener(({ data }) => {
    if (data === lastToken) return;
    lastToken = data;
    onChange();
  });
  return () => sub.remove();
}

export function openSettings() {
  return Linking.openSettings();
}

export async function isRegistered() {
  return !!(await SecureStore.getItemAsync(KEY_ITEM));
}

// The key (made once, kept until unregister) and the current FCM token, for the server.
export async function register() {
  let key = await SecureStore.getItemAsync(KEY_ITEM);
  if (!key) {
    key = toBase64(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(KEY_ITEM, key);
  }
  return { token: await getToken(), key };
}

export async function getToken() {
  lastToken = (await Notifications.getDevicePushTokenAsync()).data;
  return lastToken;
}

// Forgets the key, and the token with it: a message still in flight can't be read, and one sent
// to the old token is answered "unregistered", so the server deletes it even if our DELETE failed.
export async function unregister() {
  await SecureStore.deleteItemAsync(KEY_ITEM);
  await Notifications.unregisterForNotificationsAsync().catch(() => {});
}

/** `enc` = base64(iv 12 | ciphertext | tag 16), AES-256-GCM with this phone's key → the content
 * object, or null when there's no key (turned off) or it doesn't open. */
export async function decrypt(enc) {
  const key = await SecureStore.getItemAsync(KEY_ITEM);
  if (!key) return null;
  try {
    const blob = fromBase64(enc);
    const plain = gcm(fromBase64(key), blob.subarray(0, 12)).decrypt(
      blob.subarray(12),
    );
    return JSON.parse(utf8(plain));
  } catch {
    return null;
  }
}

export async function show({ notificationId, title, body, url }) {
  await init(); // a headless run may come before the app ever opened this session
  await Notifications.scheduleNotificationAsync({
    // Same id = replaces: a retried duplicate doesn't show twice.
    identifier: notificationId,
    content: { title, body, data: { url } },
    trigger: { channelId: CHANNEL_ID },
  });
}

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// Hermes has no TextDecoder.
const utf8 = (bytes) =>
  decodeURIComponent(escape(String.fromCharCode(...bytes)));
