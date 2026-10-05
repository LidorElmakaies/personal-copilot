// Baked in at build time by frontend/Dockerfile from version/versions.json; null in a dev server.
export const VERSION = {
  app: process.env.EXPO_PUBLIC_APP_VERSION || null,
  frontend: process.env.EXPO_PUBLIC_FRONTEND_VERSION || null,
  builtAt: process.env.EXPO_PUBLIC_BUILT_AT || null,
};
