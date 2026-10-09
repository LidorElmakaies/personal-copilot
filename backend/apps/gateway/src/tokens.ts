// DI tokens for apps/gateway — string/Symbol tokens so Application-layer code depends only on an
// interface, never a concrete Infrastructure class.

// proxy
export const PROXY_SERVICE = Symbol('PROXY_SERVICE');
export const SERVICE_CLIENTS = Symbol('SERVICE_CLIENTS');

// realtime
export const REALTIME_CONNECTION_SERVICE = Symbol(
  'REALTIME_CONNECTION_SERVICE',
);
export const CONNECTION_STORE = Symbol('CONNECTION_STORE');

// app-update
export const EVENT_CONSUMER = Symbol('IEventConsumer');

// calendar (@app/jewish-calendar, in-process)
export const SHABBAT_CALENDAR = Symbol('IShabbatCalendar');

// admin
export const ADMIN_STATUS_SERVICE = Symbol('ADMIN_STATUS_SERVICE');
export const HEALTH_PROBES = Symbol('HEALTH_PROBES');
