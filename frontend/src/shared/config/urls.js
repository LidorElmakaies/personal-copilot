// Baked in at build time — see docs/specs/services.md#frontend. Gateway (EXPO_PUBLIC_GATEWAY_ORIGIN)
// is optional: only the dormant login and account screens call it, and they fail without it.
const BASE_URL = process.env.EXPO_PUBLIC_GATEWAY_ORIGIN || null;

export const URLS = {
  gateway: BASE_URL, // every API call and /ws; null when the build has none
  wsPath: '/ws',
  // The APK registry's folder (latest.json), baked in by `apk.js build` only — null on the web.
  apkRegistry: process.env.EXPO_PUBLIC_APK_REGISTRY_URL || null,
};
