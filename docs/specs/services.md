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
- `GET /reminders`, `PUT /reminders/shabbat-candles`, `DELETE /reminders/shabbat-candles`
  (`JwtAuthGuard`) → Reminders Service's routes of the same name. Body relayed untouched.
- **User identity for internal services:** a guarded route forwards only the token's user id, in
  an `X-User-Id` header Gateway sets itself (`USER_ID_HEADER` in `@app/auth-kernel`). Client
  headers are never passed through, so a client can't supply its own. The internal service reads
  it with `@ForwardedUserId()` (401 if absent) and trusts it because only Gateway can reach it, so
  no internal service needs `JWT_SECRET`.
- Every proxy module (`auth-proxy`, `calendar-proxy`, `notifications-proxy`, `reminders-proxy`) is built on one shared forwarder in
  `src/proxy/`: `ServiceHttpClient` (one instance per internal service, base URL from
  `<SERVICE>_SERVICE_URL`), `writeProxyResponse`, and the `ProxyRequest`/`ProxyResponse` types. An
  unreachable service answers `502 { error: { code: '<service>_unreachable', message } }`.
- Global rate limiting (`@nestjs/throttler`, `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`, default
  60s/100req) plus a tighter limit on `register`/`login`/`refresh`/`account`
  (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`, default 60s/5req) — those are the brute-force
  targets now that Gateway can be reached from the open internet via the cloud path (password
  guessing, email enumeration, refresh/session abuse). `logout`, `/calendar/*`,
  `/notifications/*`, and `/reminders/*` stay on the global default (`logout` needs a valid refresh token already, so
  hammering it gains nothing); see
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
plaintext). Access tokens: 15-min TTL, `{ sub, role, email }` payload. `UserRole` is
`'user' | 'admin'` (`@app/auth-kernel`); `register` always creates `'user'`. The only `'admin'` is
the one `AdminSeedService` creates once at boot from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (see
`docs/auth/environment.md`). Nothing grants admin rights yet — and `JsonWebTokenService.verify`
accepts only `role: 'user'`, so an admin's access token is currently rejected by every
`JwtAuthGuard` route and the WS handshake.

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
- `GET /calendar/candle-lighting/next?lat&lon&tz&after` — internal, for Reminders; Gateway doesn't
  forward it. The first Friday candle lighting strictly after `after` (ISO with `Z` or an offset,
  defaults to now): `{ "candleLighting": "2026-10-09T14:55:00.000Z" }`. Same location rules as
  above. Weeks with no sunset are skipped; `422` only after 26 such weeks in a row.
- `GET /health`.

See `backend/apps/calendar/README.md` for the non-obvious implementation details.

## reminders

HTTP, internal-only, its own `reminders` database (`REMINDERS_DATABASE_URL`). User from Gateway's
`X-User-Id` (`@ForwardedUserId()`, 401 without it). One `reminders` row per user and type
(`user_id`, `type`, `offset_min`, `lat`, `lon`, `tz`, `enabled`, `next_fire_at`; unique
`(user_id, type)`). The only type so far is `shabbat_candles`.

- `GET /reminders` → the caller's reminders, enabled or not:
  `[{ type, offsetMinutes, lat, lon, tz, enabled, nextFireAt }]`.
- `PUT /reminders/shabbat-candles` — `{ offsetMinutes, lat, lon, tz }` → the saved reminder.
  Turns it on, or updates it. `offsetMinutes` is a whole number 1–1440; `lat`/`lon` numbers in
  range; `tz` an IANA zone → `400` otherwise.
- `DELETE /reminders/shabbat-candles` → `204`. Turns it off but keeps the row, so the settings can
  prefill the sheet next time. Idempotent.
- `GET /health`.

Nothing fires yet: `next_fire_at` stays `null` until the scheduler (plan task 2.6) sets it.

## notifications

HTTP + BullMQ worker, internal-only, its own `notifications` database
(`NOTIFICATIONS_DATABASE_URL`, push subscriptions) plus the shared Redis (`REDIS_URL`, its queues).
Stores browsers' Web Push subscriptions and delivers `notification-requested` jobs to them.
Publishers decide *what* and *when*; this service decides *how* (one `INotificationChannel`
adapter per channel — `WebPushChannel` today).

- `GET /notifications/vapid-public-key` → `{ publicKey }`, the server's VAPID public key
  (base64url), which the browser passes to `PushManager.subscribe`.
- `POST /notifications/subscriptions` — the browser's `PushSubscription.toJSON()` as-is
  (`{ endpoint, expirationTime, keys: { p256dh, auth } }`) → `204`. `endpoint` must be `https`, no
  explicit port, on a known push-service host or a subdomain of one (`models/push-endpoint-policy.ts`:
  FCM for Chrome/Brave, Mozilla, Apple, Microsoft) — it's what the sender POSTs to, so the server
  can't be pointed anywhere else. The host must be plain (`[a-z0-9.-]`) and Node's legacy
  `url.parse` must see the same host as WHATWG `URL`, since `web-push` dials the legacy one. Keys
  base64url: `p256dh` exactly 65 bytes (uncompressed P-256), `auth` exactly 16. Upsert on
  `endpoint`: re-registering the same browser moves it to whoever is signed in now.
- `DELETE /notifications/subscriptions` — `{ endpoint }` → `204`, removed only if it belongs to the
  caller; idempotent.
- Both subscription routes take the user from Gateway's `X-User-Id` (see Gateway above), `401`
  without it.

`push_subscriptions` table: `id`, `user_id` (indexed), `endpoint` (unique), `p256dh`, `auth`,
`created_at`. VAPID keys come from `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`; the
service refuses to boot without them (see `docs/notifications/environment.md`).

Delivery (queue `notification-requested`, consume-only — this service publishes nothing; see
[`notification-flow.md`](notification-flow.md) for the diagram and `event-schemas.md` for the job
shape and the publish options every publisher uses). One job per notification, retried as a whole;
the job's progress records which devices are already done, so a retry only tries the rest. A rare
duplicate on one device is accepted in exchange for never losing a notification to a transient
push-service error.
- **Expired → dropped.** `NotificationDeliveryService` checks `expiresAt` on every attempt; an
  expired job completes without sending anything (so it isn't retried either).
- **Channels.** It calls `deliver(userId, content, expiresAt, progress)` on every channel in
  `channels` (every channel when omitted). Every channel runs even if an earlier one throws; the
  first error is rethrown afterwards, so the job is retried.
- **Web Push (`WebPushChannel`).** On every attempt it looks up the user's *current* subscriptions,
  so a device removed or taken over by another user since the job was queued isn't sent to, and one
  added since is. Devices already marked done in the job's progress (`webpush:<subscriptionId>`)
  are skipped. A subscription whose host is no longer on the allowlist is deleted, nothing sent.
  Otherwise the payload `{ notificationId, title, body, url? }` is sent as JSON, encrypted for that
  browser (RFC 8291, `aes128gcm`) and signed with the VAPID key; the push service never sees the
  text (proven by `apps/notifications/test/web-push-encryption.spec.ts`). TTL = whole seconds left
  until `expiresAt`, so the push service drops it rather than show it on a phone that comes online
  too late.
- **Push service answer, per device.** Sent → marked done. 404/410 → subscription deleted, marked
  done. 429, 5xx, a network error (`ECONNREFUSED`, `ETIMEDOUT`, …) or web-push's timeout → left
  undone. Any other failure (other 4xx, unusable keys) → logged, marked done, not retried. If any
  device was left undone, the channel throws `RetryableDeliveryException` after trying the rest and
  BullMQ retries the job (8 attempts, exponential backoff from 30 s — about an hour in total, cut
  short by `expiresAt`). A failing database call also throws, so it's retried too.

Nothing about a notification is stored beyond its jobs: BullMQ keeps completed jobs for 24 h and
failed ones for 7 days (inspect with any Redis client against the `bull:notification-requested:*`
keys).

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

## libs/queue-contracts / libs/queue-client

`queue-client`: `IQueuePublisher`/`BullmqQueuePublisher` (`publish(queue, data, { dedupeId,
dedupeTtlMs, delayMs, attempts, backoffMs })`, JSON job data, one BullMQ `Queue` per name) and
`IQueueConsumer`/`BullmqQueueConsumer` (`process(queue, guard, handler, { concurrency })`, the
handler getting the data plus `JobMeta` — ids, attempt number, and the job's `progress` with
`saveProgress(patch)`, which is kept across retries; workers
start on `onApplicationBootstrap` and close on `onModuleDestroy`, finishing in-flight jobs, before
the publisher's queues close on `onApplicationShutdown`; a job failing the guard fails with `UnrecoverableError`, never
retried; a handler that throws is retried while the job has attempts left). Both connect via
`REDIS_URL`; the only files that import `bullmq`.
`queue-contracts`: this project's cross-service queue names and job types with their guards —
currently `notification-requested`, processed by Notification Service; nothing publishes it yet.
Also `notificationRequestedPublishOptions(message)`, the dedupe/retry options every publisher of
that queue must pass. See `event-schemas.md`.
