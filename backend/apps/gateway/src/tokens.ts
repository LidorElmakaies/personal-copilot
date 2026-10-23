// DI tokens for apps/gateway — string/Symbol tokens so Application-layer code depends only on an
// interface, never a concrete Infrastructure class.

// proxy
export const PROXY_SERVICE = Symbol('PROXY_SERVICE');
export const SERVICE_CLIENTS = Symbol('SERVICE_CLIENTS');

// admin
export const ADMIN_STATUS_SERVICE = Symbol('ADMIN_STATUS_SERVICE');
export const HEALTH_PROBES = Symbol('HEALTH_PROBES');
