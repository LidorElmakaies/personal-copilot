// Named @Throttle() policies for Gateway controllers, one per concern — see gateway.module.ts for
// the global default each of these tightens. Add more here as new controllers need their own
// (e.g. a future `telegramStrictThrottlePolicy`), rather than inlining one in its own controller.

// Stricter than the global default — for auth-proxy routes that are realistic brute-force targets
// now that Gateway is reachable from the open internet via Caddy (register/login/refresh).
export const authStrictThrottlePolicy = {
  default: {
    ttl: () => Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60000),
    limit: () => Number(process.env.AUTH_THROTTLE_LIMIT ?? 5),
  },
};
