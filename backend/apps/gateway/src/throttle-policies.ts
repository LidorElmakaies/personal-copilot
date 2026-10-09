// Named rate-limit policies, one per risk profile — see backend/apps/gateway/README.md's "Two
// rate-limit tiers" section.

// Brute-force/enumeration surface: the credential routes (PROXY_ROUTES' throttle: 'strict') and
// POST /realtime/device.
export const authStrictThrottlePolicy = {
  default: {
    ttl: () => Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60000),
    limit: () => Number(process.env.AUTH_THROTTLE_LIMIT ?? 5),
  },
};
