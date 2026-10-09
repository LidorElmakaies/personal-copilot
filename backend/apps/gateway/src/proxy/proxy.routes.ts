import type { ProxyRoute } from './application/interfaces/proxy-service.interface';

// Every route Gateway forwards to an internal service — each row becomes one Nest route
// (api/proxy.controller.ts); anything not listed is a 404. See docs/specs/services.md#gateway.
// prettier-ignore
export const PROXY_ROUTES: readonly ProxyRoute[] = [
  // Unguarded: each carries its own credentials (password or refresh token).
  { method: 'POST', path: '/auth/register', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'POST', path: '/auth/login', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'POST', path: '/auth/refresh', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'POST', path: '/auth/logout', service: 'users', auth: 'none' },
  { method: 'POST', path: '/auth/account', service: 'users', auth: 'none', throttle: 'strict' },
  { method: 'DELETE', path: '/auth/account', service: 'users', auth: 'none', throttle: 'strict' },

  { method: 'GET', path: '/users/me', service: 'users', auth: 'user' },
  { method: 'PATCH', path: '/users/me', service: 'users', auth: 'user' },
  { method: 'PUT', path: '/users/me/location', service: 'users', auth: 'user' },

  { method: 'GET', path: '/reminders', service: 'reminders', auth: 'user' },
  { method: 'PUT', path: '/reminders/shabbat-candles', service: 'reminders', auth: 'user' },
  { method: 'DELETE', path: '/reminders/shabbat-candles', service: 'reminders', auth: 'user' },

  // Open: the browser needs it before login matters.
  { method: 'GET', path: '/notifications/vapid-public-key', service: 'notifications', auth: 'none' },
  { method: 'POST', path: '/notifications/subscriptions', service: 'notifications', auth: 'user' },
  { method: 'DELETE', path: '/notifications/subscriptions', service: 'notifications', auth: 'user' },
];
