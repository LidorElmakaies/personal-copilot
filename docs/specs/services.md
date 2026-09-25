# Services

Two NestJS apps in `backend/apps/`, one shared event-bus lib pair, one frontend. See
`architecture.md` for the topology diagram.

## gateway

The only backend service reachable from outside the Docker network — directly over Tailscale, or
(in the cloud/Hetzner deployment — see `architecture.md`'s "System topology") indirectly via an SSH
tunnel from a Caddy instance on the public internet. HTTP + WebSocket.

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/account` — one
  hardcoded route per operation, not a wildcard proxy; each forwards to the identically-named Auth
  Service route with the body untouched. No guard on any of them (for the first four, that's how
  you get a token in the first place; `account` is body-driven the same way — see `apps/auth`
  below). No `GET /me` — there's nothing left for it to return that the
  client can't already decode from its own access token (see `apps/auth`'s note below).
- Global rate limiting (`@nestjs/throttler`, `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`, default
  60s/100req) plus a tighter limit on `register`/`login`/`refresh`/`account`
  (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`, default 60s/5req) — those are the brute-force
  targets now that Gateway can be reached from the open internet via the cloud path (password
  guessing, email enumeration, refresh/session abuse). `logout` deliberately stays on the global
  default — it needs a valid refresh token already, so hammering it gains nothing; see
  `backend/apps/gateway/README.md` for the full reasoning behind the two-tier split. Keyed on
  client IP; `main.ts` sets `app.set('trust proxy', 'loopback')` so that IP is correct behind the
  SSH tunnel without letting a directly-reached connection spoof it — see `architecture.md`.
- `src/realtime/` — Socket.IO at path `/ws` (token in the handshake's `auth.token`, verified the
  same way as the HTTP guard). Generic plumbing: no feature pushes anything over it yet.
  `IRealtimeConnectionService.pushToUser(userId, event, payload)` is the entry point a future
  feature module injects (import `RealtimeModule`) to reach a specific user's live connection —
  returns `false`, not an error, if they have none open. In-memory connection store, single
  Gateway replica only (this project's actual scale) — a Redis-backed store (Socket.IO's official
  Redis adapter) is the upgrade path if that ever changes.
- CORS is permissive (`origin: true`, reflects any origin) on both HTTP and the WS handshake —
  both the local frontend build (different origin than Gateway during dev) and the cloud path
  (same-origin via Caddy's reverse proxy, so this doesn't come into play there) work either way.
  Revisit if Gateway is ever reachable directly (not proxied) from the open internet.

## auth

HTTP, internal-only — never published to the host, only Gateway calls it.

- `POST /auth/register` — `{ email, password }` → `{ access_token, refresh_token }`.
- `POST /auth/login` — same shape.
- `POST /auth/refresh` — `{ refresh_token }` → new `{ access_token, refresh_token }` (rotates; the
  old refresh token is revoked regardless of outcome).
- `POST /auth/logout` — `{ refresh_token }` → revokes it.
- `POST /auth/account` — `{ email, currentPassword, newEmail?, newPassword? }` → fresh
  `{ access_token, refresh_token }`. Verifies `currentPassword` the same way `login` verifies a
  password, then applies whichever of `newEmail`/`newPassword` is present in one atomic update
  (`newEmail` uniqueness-checked, `409 Conflict`, same as `register`; `newPassword` hashed the same
  way as at registration). Throws `400 Bad Request` if neither field is set. One endpoint covering
  both fields rather than two — the frontend's combined edit form submits whichever field(s)
  changed in a single call, and an atomic request structurally rules out a caller ever
  authenticating a second sequential call with an already-stale password, something two separate
  endpoints couldn't guarantee.

None of these return a `user` object — the access token itself carries `{ sub, role, email }`
(`@app/auth-kernel`'s `JwtPayload`), so there's nothing left for a `GET /me` endpoint to return
that the client can't already decode. `account` is body-driven (`currentPassword` is the proof of
identity) rather than `JwtAuthGuard`-gated, deliberately consistent with this service's existing
stateless pattern rather than introducing bearer-token auth for just this one caller. `account`
always reissues a token pair, even on a password-only change: a token issued before the change
would otherwise keep showing a stale `email` claim until it naturally expired if only the email
changed, and always reissuing gives the endpoint one response shape regardless of which field(s)
were updated.

Postgres via TypeORM (`users`, `refresh_tokens`), password_hash = SHA256(`PASSWORD_PEPPER` + salt +
plaintext). Access tokens: 15-min TTL, `{ sub, role, email }` payload. `UserRole` has exactly one
value (`'user'`) — no admin/role system in this project.

Refresh tokens are stored as a plain SHA-256 hash (no salt/pepper) — sufficient since a refresh
token is already a high-entropy random value, not human-guessable like a password, so this only
guards against a raw DB leak, not brute force. `refresh` always revokes the used token first, then
issues a new pair, so a stolen-and-replayed refresh token only ever works once.

## frontend

Expo Router app. Login is optional app-wide, not a gate on the whole app: `(tabs)` routes are
reachable while signed out, and `(auth)/login`/`(auth)/register` each add a "Continue without
logging in" link (routes to `/`) for whoever lands there without wanting to authenticate.

- `(tabs)/index` (Home — the landing tab, no session required: live clock, today's Gregorian date,
  and today's Hebrew/Jewish date via `@hebcal/hdate`, chosen over `Intl`'s `'he-u-ca-hebrew'`
  calendar extension because Hermes's bundled ICU data isn't guaranteed to include non-Gregorian
  calendar tables on-device — see `frontend/README.md`; a live/disconnected connection chip read
  straight from `wsSlice.status`).
- `(tabs)/account` (theme toggle, logged-in account, edit account email/password, logout) — the
  one tab opted into `requiresAuth: true` (`(tabs)/_layout.js`'s `TABS`). `CustomTabBar` intercepts
  a press on a `requiresAuth` tab while signed out and shows `ConfirmModal` ("Log in to view
  Account?") instead of navigating; a direct hit on the route (deep link, web refresh, reopening
  the app on this tab) bypasses that entirely, so `AccountScreen` also calls `useRequireAuth()`
  on mount and renders `RequireAuthNotice` in that case — both are generic (`src/hooks/`,
  `src/components/`), reusable by any future `requiresAuth` tab, not Account-specific.
  `AccountEditForm` is a tap-to-reveal form for both editable fields at once, wired to Auth
  Service's `account` endpoint (see `apps/auth` above) via a single `updateAccount` thunk in
  `authSlice`, with one `Alert` reporting success/failure for the whole request.

Talks only to Gateway (`EXPO_PUBLIC_GATEWAY_ORIGIN`, baked in at build time, required —
`src/config/urls.js` throws at load if it's unset) — never Auth Service or any other backend
service directly.

Themed via a three-layer pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`) and shared
components (`GlowCard`, `GradientButton`, `InputField`, `AmbientBackground`, `ConfirmModal`,
`Alert`, `AccountEditForm`, `RequireAuthNotice`) — see `.claude/agents/frontend.md` for the full
convention and why there's no Gluestack layer here.

`src/services/` is split by transport: `http/` (fetch-based calls — `authService`) and `ws/`
(`socketService`, a single shared Socket.IO connection). `wsSlice`'s `connectWebSocket`/
`disconnectWebSocket` thunks open/close it whenever `authSlice.accessToken` changes
(`app/_layout.js`'s `RealtimeConnectionManager`) — generic plumbing, same as Gateway's `/ws`; no
feature listens for a specific event yet. A future feature attaches its own listener via
`socketService.getSocket()` rather than opening a second connection.

`authSlice` stores the `refreshToken` that register/login return but doesn't consume it yet — no
refresh thunk exists, since the 15-min access token is short enough that logging in again is an
acceptable v1.

## libs/auth-kernel

Shared JWT sign/verify (`IJwtService`/`JsonWebTokenService`, the only class allowed to import
`jsonwebtoken`), the higher-level `IAuthTokenService`/`AuthTokenService` used by every guard,
`JwtAuthGuard`, and the `CurrentUser` param decorator. Used by both `apps/auth` (signs, on
login/register) and `apps/gateway` (verifies — no route currently uses the guard, but it's ready
for the first one that needs it).

## libs/kafka-contracts / libs/kafka-client

Generic Kafka plumbing kept from an earlier feature: `kafka-client` (the producer wrapper,
`IEventPublisher`/`KafkajsEventPublisher`) and `kafka-contracts` (this project's own topics/message
shapes). `kafka-contracts` is currently an empty shell — no topic exists yet. The Kafka broker
itself still runs (`devops/kafka/docker-compose.yml`); nothing produces or consumes today. See
`event-schemas.md`.
