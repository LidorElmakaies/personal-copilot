// Baked in at build time (EXPO_PUBLIC_GATEWAY_ORIGIN) — see docs/specs/services.md#frontend.
// Required, no fallback — copy .env.example to .env for local dev.
const BASE_URL = process.env.EXPO_PUBLIC_GATEWAY_ORIGIN;
if (!BASE_URL) {
  throw new Error('EXPO_PUBLIC_GATEWAY_ORIGIN is not set');
}

export const URLS = {
  base: BASE_URL,
  auth: {
    origin: BASE_URL,
  },
  calendar: {
    origin: BASE_URL,
  },
  users: {
    origin: BASE_URL,
  },
  notifications: {
    origin: BASE_URL,
  },
  reminders: {
    origin: BASE_URL,
  },
  ws: {
    origin: BASE_URL,
    path: '/ws',
  },
};
