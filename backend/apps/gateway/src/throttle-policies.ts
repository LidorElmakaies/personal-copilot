// One named policy per controller with a distinct risk profile, added here rather than inlined —
// see backend/apps/gateway/README.md's "Two rate-limit tiers" section.

// Auth-proxy's brute-force/enumeration surface — see backend/apps/gateway/README.md.
export const authStrictThrottlePolicy = {
  default: {
    ttl: () => Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60000),
    limit: () => Number(process.env.AUTH_THROTTLE_LIMIT ?? 5),
  },
};
