# Services

Two NestJS apps in `backend/apps/`, one shared event-bus lib pair, one frontend. See
`architecture.md` for the topology diagram.

## gateway

The only backend service reachable from outside the Docker network (published to the host,
reachable from your phone over Tailscale). HTTP + WebSocket.

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` — pure pass-through to
  Auth Service, no guard (that's how you get a token in the first place). No `GET /me` — there's
  nothing left for it to return that the client can't already decode from its own access token
  (see `apps/auth`'s note below).
- `src/realtime/` — Socket.IO at path `/ws` (token in the handshake's `auth.token`, verified the
  same way as the HTTP guard). Generic plumbing: no feature pushes anything over it yet.
  `IRealtimeConnectionService.pushToUser(userId, event, payload)` is the entry point a future
  feature module injects (import `RealtimeModule`) to reach a specific user's live connection —
  returns `false`, not an error, if they have none open. In-memory connection store, single
  Gateway replica only (this project's actual scale) — a Redis-backed store (Socket.IO's official
  Redis adapter) is the upgrade path if that ever changes.
- CORS is permissive (`origin: true`, reflects any origin) on both HTTP and the WS handshake — the
  frontend's web build runs on a different origin than Gateway during dev, and Tailscale is this
  project's actual access boundary. Revisit before Gateway is ever reachable outside the Tailnet.

## auth

HTTP, internal-only — never published to the host, only Gateway calls it.

- `POST /auth/register` — `{ email, password }` → `{ access_token, refresh_token }`.
- `POST /auth/login` — same shape.
- `POST /auth/refresh` — `{ refresh_token }` → new `{ access_token, refresh_token }` (rotates; the
  old refresh token is revoked regardless of outcome).
- `POST /auth/logout` — `{ refresh_token }` → revokes it.

None of these return a `user` object — the access token itself carries `{ sub, role, email }`
(`@app/auth-kernel`'s `JwtPayload`), so there's nothing left for a `GET /me` endpoint to return
that the client can't already decode. This only works because the project has no profile-editing
feature; if one's ever added, a 15-min-stale email in an already-issued token becomes a real
tradeoff to reconsider, not a non-issue.

Postgres via TypeORM (`users`, `refresh_tokens`), password_hash = SHA256(`PASSWORD_PEPPER` + salt +
plaintext). Access tokens: 15-min TTL, `{ sub, role, email }` payload. `UserRole` has exactly one
value (`'user'`) — no admin/role system in this project.

Refresh tokens are stored as a plain SHA-256 hash (no salt/pepper) — sufficient since a refresh
token is already a high-entropy random value, not human-guessable like a password, so this only
guards against a raw DB leak, not brute force. `refresh` always revokes the used token first, then
issues a new pair, so a stolen-and-replayed refresh token only ever works once.

## frontend

Expo Router app. `(auth)/login`, `(auth)/register`, `(tabs)/index` (Settings — theme toggle,
logged-in account, live connection status, logout). Talks only to Gateway
(`EXPO_PUBLIC_GATEWAY_ORIGIN`, baked in at build time, required — `src/config/urls.js` throws at
load if it's unset) — never Auth Service or any other backend service directly.

Themed via a three-layer pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`) and shared
components (`GlowCard`, `GradientButton`, `InputField`, `SpaceBackground`, `ConnectionStatus`) —
see `.claude/agents/frontend.md` for the full convention and why there's no Gluestack layer here.

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
