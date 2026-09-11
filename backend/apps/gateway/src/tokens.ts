// DI tokens for apps/gateway — string/Symbol tokens so Application-layer code depends only on an
// interface, never a concrete Infrastructure class.

// auth-proxy
export const AUTH_PROXY_SERVICE = Symbol('AUTH_PROXY_SERVICE');
export const AUTH_SERVICE_CLIENT = Symbol('AUTH_SERVICE_CLIENT');

// realtime
export const REALTIME_CONNECTION_SERVICE = Symbol(
  'REALTIME_CONNECTION_SERVICE',
);
export const CONNECTION_STORE = Symbol('CONNECTION_STORE');
