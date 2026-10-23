# Gateway — implementation notes

The contract (endpoints, modules, responsibilities) lives in
[`docs/specs/services.md`](../../../docs/specs/services.md#gateway) and the topology diagrams in
[`docs/specs/architecture.md`](../../../docs/specs/architecture.md). This file is the "why" behind
decisions here that aren't obvious from the code or from those docs alone — read it before changing
`main.ts`, `gateway.module.ts`, `throttle-policies.ts` or `src/proxy/`.

## `TRUST_PROXY` (`src/trust-proxy.ts`)

Full reasoning: `docs/specs/architecture.md#system-topology`. Short version: the rate limiter
keys on the client IP, but every connection reaches the container from Docker's bridge
(`tailscale serve` is a local proxy, and Docker's port publishing adds a hop),
so the socket peer never says who the client is. `TRUST_PROXY` (`loopback` + `uniquelocal`) lets
those hops' `X-Forwarded-For` through. It's safe only because the port is published on `127.0.0.1`
(`devops/gateway/docker-compose.yml`): nothing outside the machine can connect and forge the
header. Don't widen it to `true`, and don't publish the port on all interfaces.

## Two rate-limit tiers, not per-route or one global (`gateway.module.ts`, `throttle-policies.ts`)

- Global default (`THROTTLE_TTL_MS`/`THROTTLE_LIMIT`) is the floor every route gets, sized for
  normal traffic. It exists so a new route can never end up completely unthrottled just because
  nobody added a decorator to it.
- `authStrictThrottlePolicy` (`throttle-policies.ts`) is a much tighter override, applied to
  `register`/`login`/`refresh`/`account` (`throttle: 'strict'` in `PROXY_ROUTES`) — the routes where throughput is directly
  useful to an attacker (password guessing, email enumeration, refresh-token abuse; `account`
  verifies `currentPassword` from the request body the same way `login` does, so it carries the
  same guessing risk). `logout` deliberately stays on the global default: it needs a valid refresh
  token already, so hammering it gains nothing.
- `/users/me*` stays on the global default: it needs a valid access token already.
- Add a new named policy to `throttle-policies.ts` for a future controller with a similarly
  distinct risk profile, rather than inlining a one-off `@Throttle()` config in that controller or
  folding it into the global default.

## One route table, not a module per service (`src/proxy/`)

Forwarding is the same for every service, so the routes are data: `PROXY_ROUTES`, one row each.
`ProxyController` doesn't catch a wildcard and match it — it applies `RequestMapping`, `UseGuards`
and `Throttle` to one generated handler per row, the same decorators a hand-written route would
have. So Nest still does the routing (unlisted → `404`), the guard and the rate limit, and each
handler is named after its row (`POST /auth/login`), which keys its own rate-limit counter.
Because the table decides who needs a token, `test/proxy.api.spec.ts` checks it against a
`CONTRACT` written out separately — a wrong row fails there instead of quietly opening a route.

## Permissive CORS (`app.enableCors({ origin: true })`)

Reflects any origin. Safe here: Gateway is reachable only inside the tailnet (`tailscale serve`),
its client is the native app (CORS applies only to browsers), and nothing uses cookies or
credentialed CORS — every guarded route needs a bearer token a foreign page doesn't have. Revisit if
Gateway is ever reached from the open internet.
