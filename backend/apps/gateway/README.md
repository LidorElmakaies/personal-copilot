# Gateway — implementation notes

The contract (endpoints, modules, responsibilities) lives in
[`docs/specs/services.md`](../../../docs/specs/services.md#gateway) and the topology diagrams in
[`docs/specs/architecture.md`](../../../docs/specs/architecture.md). This file is the "why" behind
decisions here that aren't obvious from the code or from those docs alone — read it before changing
`main.ts`, `gateway.module.ts`, `throttle-policies.ts`, `src/proxy/`, `src/realtime/` or
`src/app-update/`.

## `TRUST_PROXY` (`src/trust-proxy.ts`)

Full reasoning: `docs/specs/architecture.md#system-topology`. Short version: the rate limiter
keys on the client IP, but every connection reaches the container from Docker's bridge
(`tailscale serve` and the SSH tunnel are local proxies, and Docker's port publishing adds a hop),
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
  token already, so hammering it gains nothing. Realtime's `POST /realtime/device` uses it too: each
  device token is another `/ws` connection, so the limit is what stops connection flooding.
- `/calendar/*` stays on the global default: read-only and cheap, nothing to guess. So do
  `/notifications/*`, `/reminders*` and `/users/me*`: the VAPID key is public, and the rest need a
  valid access token already.
- Add a new named policy to `throttle-policies.ts` for a future controller with a similarly
  distinct risk profile, rather than inlining a one-off `@Throttle()` config in that controller or
  folding it into the global default.

## One route table, not a module per service (`src/proxy/`)

Forwarding is the same for every service, so the routes are data: `PROXY_ROUTES`, one row each.
`ProxyController` doesn't catch a wildcard and match it — it applies `RequestMapping`, `UseGuards`
and `Throttle` to one generated handler per row, the same decorators a hand-written route would
have. So Nest still does the routing (unlisted → `404`), the guard and the rate limit, and each
handler is named after its row (`POST /auth/login`), which keys its own rate-limit counter.
Because the table now decides who needs a token, `test/proxy.api.spec.ts` checks it against a
`CONTRACT` written out separately — a wrong row fails there instead of quietly opening a route.

## Permissive CORS (`app.enableCors({ origin: true })`)

Reflects any origin. Safe in both topologies today: over Tailscale the frontend calls Gateway
cross-origin (`https://<pc>.ts.net` → `:8443`; no cookies/credentialed CORS in play), and the cloud
path is same-origin by construction (the frontend's Caddy reverse-proxies every Gateway route —
its `@gateway` matcher — from the same domain the frontend is served on, so the browser never sees
a cross-origin request at all). Revisit if Gateway is ever reached directly, unproxied, from the open internet.

## Device tokens on `/ws` (`src/realtime/`)

Anonymous connections need no login, and `@nestjs/throttler` never sees a Socket.IO connection, so
something else has to bound how many one client can hold. An IP can't: several devices share one
(a home router), and a phone keeps its tailnet IP across networks while its old connection lingers.
A device id the client makes up can't either — it would just send a new one each time. So Gateway
issues the device id, signed, from an HTTP route (`POST /realtime/device`) that the existing strict
limit covers; `/ws` refuses any connection without a valid one, and keeps one connection per
device, a newer one replacing the old. Flooding needs many device tokens, and those come a few per
minute per IP. The check runs in Socket.IO middleware (`afterInit`), so a refusal reaches the
client as a `connect_error` reason it can act on — the app fetches a new device token on
`device_token_invalid`.

## App releases (`src/app-update/`)

The one that knows a release happened is `apk.js publish`, so it announces it: one message on
Kafka's `frontend.releases` (compacted, keyed by platform) once the newest release changes.
Gateway consumes it (group `gateway`) and broadcasts `app-update`. Gateway never reads the APK
registry. The announcement is best effort — with the stack down when publishing, apps still find
the release on their next start or return to the foreground. A new consumer group starts from the
beginning, so Gateway's very first start replays the latest release once: open apps just check.
