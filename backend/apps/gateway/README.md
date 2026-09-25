# Gateway — implementation notes

The contract (endpoints, modules, responsibilities) lives in
[`docs/specs/services.md`](../../../docs/specs/services.md#gateway) and the topology diagrams in
[`docs/specs/architecture.md`](../../../docs/specs/architecture.md). This file is the "why" behind
decisions here that aren't obvious from the code or from those docs alone — read it before changing
`main.ts`, `gateway.module.ts`, or anything under `throttle-policies.ts`.

## `trust proxy: 'loopback'` (`main.ts`)

Full reasoning: `docs/specs/architecture.md#system-topology`. Short version: the rate limiter keys
on `req.ip`. In the cloud/Hetzner deployment, every request reaching Gateway arrives via the SSH
tunnel, which makes its real TCP source `127.0.0.1` regardless of who the actual browser client
was — without this setting, the limiter can't distinguish users at all on that path. `'loopback'`
is the narrowest value that fixes it: `X-Forwarded-For` is trusted only when the request's real
socket peer is loopback (exactly the tunnel path, never a directly-reached connection like
Tailscale, and never spoofable by a remote client). Don't widen this to `true` — that would let any
client set its own `X-Forwarded-For` and dodge the limiter entirely.

## Two rate-limit tiers, not per-route or one global (`gateway.module.ts`, `throttle-policies.ts`)

- Global default (`THROTTLE_TTL_MS`/`THROTTLE_LIMIT`) is the floor every route gets, sized for
  normal traffic. It exists so a new route can never end up completely unthrottled just because
  nobody added a decorator to it.
- `authStrictThrottlePolicy` (`throttle-policies.ts`) is a much tighter override, applied to
  auth-proxy's `register`/`login`/`refresh`/`account` — the routes where throughput is directly
  useful to an attacker (password guessing, email enumeration, refresh-token abuse; `account`
  verifies `currentPassword` from the request body the same way `login` does, so it carries the
  same guessing risk). `logout` deliberately stays on the global default: it needs a valid refresh
  token already, so hammering it gains nothing.
- Add a new named policy to `throttle-policies.ts` for a future controller with a similarly
  distinct risk profile, rather than inlining a one-off `@Throttle()` config in that controller or
  folding it into the global default.

## Permissive CORS (`app.enableCors({ origin: true })`)

Reflects any origin. Safe in both topologies today: the local frontend build calls Gateway
cross-origin during dev (no cookies/credentialed CORS in play), and the cloud path is same-origin
by construction (Caddy reverse-proxies `/auth/*` and `/ws*` from the same domain the frontend is
served on, so the browser never sees this as a cross-origin request at all). Revisit if Gateway is
ever reached directly, unproxied, from the open internet.
