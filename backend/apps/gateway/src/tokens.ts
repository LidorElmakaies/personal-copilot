// DI tokens for apps/gateway — string/Symbol tokens so Application-layer code depends only on an
// interface, never a concrete Infrastructure class.

// auth-proxy
export const AUTH_PROXY_SERVICE = Symbol('AUTH_PROXY_SERVICE');
export const AUTH_SERVICE_CLIENT = Symbol('AUTH_SERVICE_CLIENT');

// calendar-proxy
export const CALENDAR_PROXY_SERVICE = Symbol('CALENDAR_PROXY_SERVICE');
export const CALENDAR_SERVICE_CLIENT = Symbol('CALENDAR_SERVICE_CLIENT');

// notifications-proxy
export const NOTIFICATIONS_PROXY_SERVICE = Symbol(
  'NOTIFICATIONS_PROXY_SERVICE',
);
export const NOTIFICATIONS_SERVICE_CLIENT = Symbol(
  'NOTIFICATIONS_SERVICE_CLIENT',
);

// reminders-proxy
export const REMINDERS_PROXY_SERVICE = Symbol('REMINDERS_PROXY_SERVICE');
export const REMINDERS_SERVICE_CLIENT = Symbol('REMINDERS_SERVICE_CLIENT');

// realtime
export const REALTIME_CONNECTION_SERVICE = Symbol(
  'REALTIME_CONNECTION_SERVICE',
);
export const CONNECTION_STORE = Symbol('CONNECTION_STORE');
