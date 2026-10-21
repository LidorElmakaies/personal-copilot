// Baked in at build time (EXPO_PUBLIC_GATEWAY_ORIGIN) — see docs/specs/services.md#frontend.
// Required, no fallback — copy .env.example to .env for local dev.
const BASE_URL = process.env.EXPO_PUBLIC_GATEWAY_ORIGIN;
if (!BASE_URL) {
  throw new Error('EXPO_PUBLIC_GATEWAY_ORIGIN is not set');
}

export const URLS = {
  gateway: BASE_URL, // every API call and /ws
  wsPath: '/ws',
  // The APK registry's folder (latest.json), baked in by `apk.js build` only — null on the web.
  apkRegistry: process.env.EXPO_PUBLIC_APK_REGISTRY_URL || null,
};
