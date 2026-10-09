// Baked in at build time (frontend/Dockerfile, `apk.js build`) from version/versions.json; null in a dev server.
export const VERSION = {
  frontend: process.env.EXPO_PUBLIC_FRONTEND_VERSION || null,
  builtAt: process.env.EXPO_PUBLIC_BUILT_AT || null,
};
