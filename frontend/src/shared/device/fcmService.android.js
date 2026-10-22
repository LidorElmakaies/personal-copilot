import { gcm } from '@noble/ciphers/aes.js';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { CHANNEL_ID, ensureChannel } from './localNotificationsService';

// Incoming FCM messages, for fcmReceiver only (no Redux knowledge): a phone registered with the
// Notification Service earlier holds a 256-bit key (the app registers none now), and every message
// arrives encrypted with it — see docs/specs/services.md#notifications.
const KEY_ITEM = 'fcmDeviceKey';

/** `enc` = base64(iv 12 | ciphertext | tag 16), AES-256-GCM with this phone's key → the content
 * object, or null when there's no key (never registered) or it doesn't open. */
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
  await ensureChannel(); // a headless run may come before the app ever opened this session
  await Notifications.scheduleNotificationAsync({
    // Same id = replaces: a retried duplicate doesn't show twice.
    identifier: notificationId,
    content: { title, body, data: { url } },
    trigger: { channelId: CHANNEL_ID },
  });
}

const fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// Hermes has no TextDecoder.
const utf8 = (bytes) =>
  decodeURIComponent(escape(String.fromCharCode(...bytes)));
