# Services

Five NestJS apps in `backend/apps/` (`gateway`, `auth`, `calendar`, `reminders`, `notifications`),
shared libs in `backend/libs/`, one frontend. See `architecture.md` for the topology diagram.

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
- `GET /calendar/shabbat?lat&lon&tz` — forwards exactly those three query params to Calendar
  Service's route of the same name and relays its status/body verbatim (Calendar validates them;
  its `400`s pass straight through). Unguarded, so Home works signed out.
- `GET /notifications/vapid-public-key` (open), `POST /notifications/subscriptions` and
  `DELETE /notifications/subscriptions` (`JwtAuthGuard`) → Notification Service's routes of the same
  name. Body relayed untouched.
- **User identity for internal services:** a guarded route forwards only the token's user id, in
  an `X-User-Id` header Gateway sets itself (`USER_ID_HEADER` in `@app/auth-kernel`). Client
  headers are never passed through, so a client can't supply its own. The internal service reads
  it with `@ForwardedUserId()` (401 if absent) and trusts it because only Gateway can reach it, so
  no internal service needs `JWT_SECRET`.
- Every proxy module (`auth-proxy`, `calendar-proxy`, `notifications-proxy`) is built on one shared forwarder in
  `src/proxy/`: `ServiceHttpClient` (one instance per internal service, base URL from
  `<SERVICE>_SERVICE_URL`), `writeProxyResponse`, and the `ProxyRequest`/`ProxyResponse` types. An
  unreachable service answers `502 { error: { code: '<service>_unreachable', message } }`.
- Global rate limiting (`@nestjs/throttler`, `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`, default
  60s/100req) plus a tighter limit on `register`/`login`/`refresh`/`account`
  (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`, default 60s/5req) — those are the brute-force
  targets now that Gateway can be reached from the open internet via the cloud path (password
  guessing, email enumeration, refresh/session abuse). `logout` and `/calendar/*`/`/notifications/*` stay on the global
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

## calendar

HTTP, internal-only, stateless (no database). Every calendar calculation lives here, using
`@hebcal/core` behind `ICalendarCalculator` (`HebcalCalendarCalculator` is the only file that
imports it).

- `GET /calendar/shabbat?lat&lon&tz` — the Shabbat in progress at request time, otherwise the next
  one, for the user's location:
  ```json
  { "candleLighting": "2026-10-02T15:04:00.000Z", "havdalah": "2026-10-03T16:00:00.000Z",
    "parasha": null, "holidays": [{ "en": "Shmini Atzeret", "he": "שמיני עצרת" }], "isNow": false }
  ```
  - `lat`/`lon` validated as coordinates, `tz` as an IANA time zone → `400` otherwise. `422` where
    there's no sunset to count from (e.g. polar summer).
  - "Today" is the user's local date in `tz`, never the server's. The Shabbat that started last
    Friday is returned while it's still running — including through a Yom Tov directly after it
    (abroad, `havdalah` can be Sunday or Monday night).
  - Israel vs. abroad rules (one- vs. two-day Yom Tov) follow `tz === 'Asia/Jerusalem'`. Candle
    lighting is 20 minutes before sunset in Israel, 18 abroad; Havdalah is Hebcal's default (sun
    8.5° below the horizon).
  - `parasha` is `null` when a holiday replaces the weekly reading. `holidays` lists what falls on
    that Saturday (holidays, Chol HaMoed, Rosh Chodesh, Chanukah, named Shabbatot), minus eves,
    modern civic days, and Leil Selichot. Names come in English and unvoweled Hebrew.
- `GET /health`.

See `backend/apps/calendar/README.md` for the non-obvious implementation details.

## reminders

HTTP, internal-only. Skeleton: boots, connects to its own `reminders` database
(`REMINDERS_DATABASE_URL`) in the shared Postgres, answers `GET /health`. No endpoints yet — will
own per-user reminders and the scheduler that publishes due ones to Kafka (see
`docs/plans/shabbat-reminders-calendar/plan.md`, stage 2).

## notifications

HTTP, internal-only, its own `notifications` database (`NOTIFICATIONS_DATABASE_URL`). Stores
browsers' Web Push subscriptions; nothing is sent yet.

- `GET /notifications/vapid-public-key` → `{ publicKey }`, the server's VAPID public key
  (base64url), which the browser passes to `PushManager.subscribe`.
- `POST /notifications/subscriptions` — the browser's `PushSubscription.toJSON()` as-is
  (`{ endpoint, expirationTime, keys: { p256dh, auth } }`) → `204`. `endpoint` must be an `https`
  URL with a real host name (it's what the sender will POST to), keys base64url. Upsert on
  `endpoint`: re-registering the same browser moves it to whoever is signed in now.
- `DELETE /notifications/subscriptions` — `{ endpoint }` → `204`, removed only if it belongs to the
  caller; idempotent.
- Both subscription routes take the user from Gateway's `X-User-Id` (see Gateway above), `401`
  without it.

`push_subscriptions` table: `id`, `user_id` (indexed), `endpoint` (unique), `p256dh`, `auth`,
`created_at`. VAPID keys come from `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`; the
service refuses to boot without them (see `docs/notifications/environment.md`).

## frontend

Expo Router app. Login is optional app-wide, not a gate on the whole app: `(tabs)` routes are
reachable while signed out, and `(auth)/login`/`(auth)/register` each add a "Continue without
logging in" link (routes to `/`) for whoever lands there without wanting to authenticate.

- `(tabs)/index` (Home — the landing tab, no session required: live clock, today's Gregorian date,
  and today's Hebrew/Jewish date via `@hebcal/hdate`, chosen over `Intl`'s `'he-u-ca-hebrew'`
  calendar extension because Hermes's bundled ICU data isn't guaranteed to include non-Gregorian
  calendar tables on-device — see `frontend/README.md`; a live/disconnected connection chip read
  straight from `wsSlice.status`, which stays "Disconnected" while signed out since the socket
  only opens with a token). Under the clock, `ShabbatSection` shows the current/next Shabbat for
  the device's location: a label (holiday or parasha, or "Shabbat Shalom" while it's in progress),
  candle lighting and Havdalah with their dates, and a countdown to whichever comes next. "In
  progress" and the countdown are computed from the device clock against the two returned times.
  - When it fetches: on Home's first mount (`locate()` for a fresh GPS fix; the persisted
    last-known location is used meanwhile), when the fix arrives, when Havdalah passes (next
    Shabbat, same location), and on Retry. Switching tabs or returning from the background doesn't
    refetch.
  - `locationSlice` persists only `coords` (`{ latitude, longitude, timeZone }`, the time zone
    from the device) and `calendarSlice` persists the last `shabbat` response, so Home still shows
    times offline. Location refused → "Location is off" + Retry (or, with a cached result, a
    "using your last known location" note).
- `(tabs)/account` (theme toggle, logged-in account, edit account email/password, logout) — the
  one tab opted into `requiresAuth: true` (`(tabs)/_layout.js`'s `TABS`). `CustomTabBar` intercepts
  a press on a `requiresAuth` tab while signed out and shows `ConfirmModal` ("Log in to view
  Account?") instead of navigating; a direct hit on the route (deep link, web refresh, reopening
  the app on this tab) bypasses that entirely, so `AccountScreen` also calls `useRequireAuth()`
  on mount and renders `RequireAuthNotice` in that case — both are generic (`src/hooks/`,
  `src/components/composite/`), reusable by any future `requiresAuth` tab, not Account-specific.
  `AccountEditForm` is a tap-to-reveal form for both editable fields at once, wired to Auth
  Service's `account` endpoint (see `apps/auth` above) via a single `updateAccount` thunk in
  `authSlice`, with one `Alert` reporting success/failure for the whole request.

Talks only to Gateway (`EXPO_PUBLIC_GATEWAY_ORIGIN`, baked in at build time, required —
`src/config/urls.js` throws at load if it's unset) — never Auth Service or any other backend
service directly.

Themed via a three-layer pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`) and shared
components under `src/components/base/` (grouped into `background`/`buttons`/`feedback`/`form`/
`layout` subfolders by purpose) and `src/components/composite/` (`AccountEditForm`, `AmbientBackground`,
`ConfirmModal`, `RequireAuthNotice`, `ShabbatSection`) — see `.claude/agents/frontend.md` for the base/composite split, the full
convention, and why there's no Gluestack layer here.

`src/services/` is split by transport: `http/` (fetch-based calls — `authService`,
`calendarService`), `ws/` (`socketService`, a single shared Socket.IO connection), and `device/`
(`locationService` — `expo-location` permission + position, plus the device's IANA time zone). `wsSlice`'s `connectWebSocket`/
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
login/register) and `apps/gateway` (verifies — `JwtAuthGuard` on `/notifications/subscriptions`).
Also `USER_ID_HEADER` + `@ForwardedUserId()`, the internal-service side of Gateway's forwarded user
id (see Gateway above) — used by `apps/notifications`.

## libs/kafka-contracts / libs/kafka-client

`kafka-client`: `IEventPublisher`/`KafkajsEventPublisher` (JSON, keyed) and
`IEventConsumer`/`KafkajsEventConsumer` (subscribe with a type guard; starts on
`onApplicationBootstrap`; invalid messages logged and skipped, handler errors retried).
`kafka-contracts`: this project's topics, consumer groups, and message types with their guards —
currently `notification.requested`. No service produces or consumes yet (plan stage 2). See
`event-schemas.md`.
