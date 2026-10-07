// DI tokens for apps/gateway — string/Symbol tokens so Application-layer code depends only on an
// interface, never a concrete Infrastructure class.

// auth-proxy
export const AUTH_PROXY_SERVICE = Symbol('AUTH_PROXY_SERVICE');
export const AUTH_SERVICE_CLIENT = Symbol('AUTH_SERVICE_CLIENT');

// notifications-proxy
export const NOTIFICATIONS_PROXY_SERVICE = Symbol(
  'NOTIFICATIONS_PROXY_SERVICE',
);
export const NOTIFICATIONS_SERVICE_CLIENT = Symbol(
  'NOTIFICATIONS_SERVICE_CLIENT',
);

// users-proxy
export const USERS_PROXY_SERVICE = Symbol('USERS_PROXY_SERVICE');
export const USERS_SERVICE_CLIENT = Symbol('USERS_SERVICE_CLIENT');

// reminders-proxy
export const REMINDERS_PROXY_SERVICE = Symbol('REMINDERS_PROXY_SERVICE');
export const REMINDERS_SERVICE_CLIENT = Symbol('REMINDERS_SERVICE_CLIENT');

// realtime
export const REALTIME_CONNECTION_SERVICE = Symbol(
  'REALTIME_CONNECTION_SERVICE',
);
export const CONNECTION_STORE = Symbol('CONNECTION_STORE');

// calendar (served here, not proxied — @app/jewish-calendar in-process)
export const SHABBAT_CALENDAR = Symbol('IShabbatCalendar');

// admin
export const ADMIN_STATUS_SERVICE = Symbol('ADMIN_STATUS_SERVICE');
export const HEALTH_PROBES = Symbol('HEALTH_PROBES');
