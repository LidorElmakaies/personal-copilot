# Services

Four NestJS apps in `backend/apps/` (`gateway`, `users`, `reminders`, `notifications`),
shared libs in `backend/libs/`, one frontend. See `architecture.md` for the topology diagram.

## gateway

The only backend service reachable from outside the Docker network — directly over Tailscale, or
(in the cloud/Hetzner deployment — see `architecture.md`'s "System topology") indirectly via an SSH
tunnel from a Caddy instance on the public internet. HTTP + WebSocket.

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/account`,
  `DELETE /auth/account` — one hardcoded route per operation, not a wildcard proxy; each forwards to
  the identically-named Users Service route with the body untouched. No guard on any of them (for
  the first four, that's how you get a token in the first place; `account` is body-driven the same
  way — see `apps/users` below).
- `GET /users/me`, `PATCH /users/me`, `PUT /users/me/location` (`JwtAuthGuard`) → Users Service's
  routes of the same name (`users-proxy`). Body relayed untouched. No `GET /me` — there's nothing left for it to return that the
  client can't already decode from its own access token (see `apps/users`'s note below).
- `GET /calendar/shabbat?lat&lon&tz` — **served by Gateway itself, not proxied** (`src/calendar/`):
  the Shabbat in progress, otherwise the next one, for that location, computed in-process with
  [`@app/jewish-calendar`](#libsjewish-calendar). The one Gateway route with logic of its own — the
  maths is the shared lib, so there's nothing for another service to add. Unguarded, so Home works
  signed out.
  ```json
  { "candleLighting": "2026-10-02T15:04:00.000Z", "havdalah": "2026-10-03T16:00:00.000Z",
    "parasha": null, "holidays": [{ "en": "Shmini Atzeret", "he": "שמיני עצרת" }], "isNow": false }
  ```
  `lat`/`lon` validated as coordinates, `tz` as an IANA time zone → `400` otherwise. `422` where
  there's no sunset to count from (e.g. polar summer).
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
- Every proxy module (`auth-proxy`, `users-proxy`, `notifications-proxy`, `reminders-proxy`) is built on one shared forwarder in
  `src/proxy/`: `ServiceHttpClient` (one instance per internal service, base URL from
  `<SERVICE>_SERVICE_URL`), `writeProxyResponse`, and the `ProxyRequest`/`ProxyResponse` types. An
  unreachable service answers `502 { error: { code: '<service>_unreachable', message } }`.
- Global rate limiting (`@nestjs/throttler`, `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`, default
  60s/100req) plus a tighter limit on `register`/`login`/`refresh`/`account` (both methods)
  (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`, default 60s/5req) — those are the brute-force
  targets now that Gateway can be reached from the open internet via the cloud path (password
  guessing, email enumeration, refresh/session abuse). `logout`, `/calendar/*`,
  `/notifications/*`, `/reminders/*` and `/users/me*` stay on the global default (`logout` needs a valid refresh token already, so
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

## users

Owns both how you log in (`users`, `refresh_tokens`) and who you are (`profiles`), and publishes profile changes and deletions on Kafka (see "Profiles" below).

HTTP, internal-only — never published to the host, only Gateway calls it.

- `POST /auth/register` — `{ email, password, firstName?, lastName?, phone? }` →
  `{ access_token, refresh_token }`. The optional details go into the profile, created in the same
  transaction as the account.
- `POST /auth/login` — same shape.
- `POST /auth/refresh` — `{ refresh_token }` → new `{ access_token, refresh_token }` (rotates; the
  old refresh token is revoked regardless of outcome).
- `POST /auth/logout` — `{ refresh_token }` → revokes it.
- `POST /auth/account` — `{ email, currentPassword, newEmail?, newPassword? }` → fresh
  `{ access_token, refresh_token }`. Verifies `currentPassword` the same way `login` verifies a
  password, then applies whichever of `newEmail`/`newPassword` is present in one atomic update
  (`newEmail` uniqueness-checked, `409 Conflict`, same as `register`; `newPassword` hashed the same
  way as at registration). Throws `400 Bad Request` if neither field is set. One endpoint covering
  both fields rather than two — the frontend's `AccountCard` form submits whichever field(s)
  changed in a single call, and an atomic request structurally rules out a caller ever
  authenticating a second sequential call with an already-stale password, something two separate
  endpoints couldn't guarantee.
- `DELETE /auth/account` — `{ email, currentPassword }` → `204`. Verified like `login`, then
  deletes the user, profile and refresh tokens in one transaction — and with them the user's
  reminders and push subscriptions, whose `user_id` foreign keys are `ON DELETE CASCADE` — and
  publishes a `users.user-state` tombstone. Immediate, no undo. An
  access token issued before keeps passing `JwtAuthGuard` until it expires (≤ 15 min), but every
  `/users/me` call with it answers `404`.
- `GET /users/me` → `{ firstName, lastName, phone, location: { lat, lon, tz, updatedAt } | null }`
  (user from `X-User-Id`). An account from before profiles gets all `null`s.
- `PATCH /users/me` — any of `{ firstName, lastName, phone }`; only the fields sent change, `null`
  clears one, none at all → `400`. Names are trimmed, 1–100 chars, English or Hebrew letters only with single spaces between words
  (`NAME_PATTERN` in `@app/kafka-contracts`, also applied by register); `phone` in international format
  (`+972501234567`). Returns the profile.
- `PUT /users/me/location` — `{ lat, lon, tz }` → the profile. The frontend sends it only after a move
  of more than 5 km or a time-zone change (see [frontend](#frontend)); `updatedAt` is set here.

**Profiles.** `profiles` table, keyed by `user_id` (the user's id and a foreign key, deleted with
the user): `first_name`, `last_name`, `phone`, `lat`, `lon`, `tz`, `location_updated_at`,
`version`. Every write locks the row, bumps `version`, and saves the full state as a
`users.user-state` event in the same transaction (the outbox, see `libs/kafka-client`), so a change
is never published without being saved or saved without being published. A missing profile (an
account from before profiles) is created on its first write. A write for a user that no longer
exists answers `404` and creates nothing.

None of these return a `user` object — the access token itself carries `{ sub, role, email }`
(`@app/auth-kernel`'s `JwtPayload`), so there's nothing left for a `GET /me` endpoint to return
that the client can't already decode. `account` is body-driven (`currentPassword` is the proof of
identity) rather than `JwtAuthGuard`-gated, deliberately consistent with this service's existing
stateless pattern rather than introducing bearer-token auth for just this one caller. `account`
always reissues a token pair, even on a password-only change: a token issued before the change
would otherwise keep showing a stale `email` claim until it naturally expired if only the email
changed, and always reissuing gives the endpoint one response shape regardless of which field(s)
were updated.

Postgres via TypeORM (`users`, `refresh_tokens`, `profiles`, `outbox_events`), password_hash = SHA256(`PASSWORD_PEPPER` + salt +
plaintext). Access tokens: 15-min TTL, `{ sub, role, email }` payload. `UserRole` is
`'user' | 'admin'` (`USER_ROLES` in `@app/auth-kernel`); `register` always creates `'user'`. The
only `'admin'` is the one `AdminSeedService` creates once at boot from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
(see `docs/users/environment.md`). `JsonWebTokenService.verify` accepts any role in `USER_ROLES`
(anything else → unauthenticated), so the admin signs in and uses every `JwtAuthGuard` route and the
WS handshake like any user. `AdminGuard` (same lib) is `JwtAuthGuard` plus `role === 'admin'`: no or
a bad token → `401`, a non-admin → `403 Admins only`. No route uses it yet.

Refresh tokens are stored as a plain SHA-256 hash (no salt/pepper) — sufficient since a refresh
token is already a high-entropy random value, not human-guessable like a password, so this only
guards against a raw DB leak, not brute force. `refresh` always revokes the used token first, then
issues a new pair, so a stolen-and-replayed refresh token only ever works once.

## reminders

HTTP, internal-only, schema `reminders` in the shared database. User from Gateway's `X-User-Id`
(`@ForwardedUserId()`, 401 without it). One `reminders` row per user and type (`user_id`, `type`,
`offset_min`, `enabled`, `next_fire_at`; unique `(user_id, type)`); `user_id` references
`users.users(id)` `ON DELETE CASCADE`, so a deleted account's reminders go with it and a reminder
can't be saved for a user that doesn't exist. The only type so far is `shabbat_candles`.

- `GET /reminders` → the caller's reminders, enabled or not:
  `[{ type, offsetMinutes, enabled, nextFireAt, waitingForLocation }]`. `waitingForLocation` is
  `true` until the user's location is known (see below) — the reminder is saved, but can't fire.
- `PUT /reminders/shabbat-candles` — `{ offsetMinutes }` → the saved reminder. Turns it on, or
  updates it. `offsetMinutes` is a whole number 1–1440 → `400` otherwise. Any `lat`/`lon`/`tz` sent
  is ignored: the location comes from the user's profile.
- `DELETE /reminders/shabbat-candles` → `204`. Turns it off but keeps the row, so the settings can
  prefill the sheet next time. Idempotent.
- `GET /health`.

**The user's location** is read straight from the Users Service's `users.profiles` (a read-only
mapping, `UsersProfileEntity` from `@app/users-schema`) — never copied, never written here.

**Scheduling** (`ReminderScheduler`): an enabled reminder with a location has `next_fire_at` =
the next candle lighting at that location (`@app/jewish-calendar`, in-process) minus the offset,
and one delayed `reminder-due` job for exactly that time (see
[event-schemas.md](event-schemas.md#reminder-due)). It's recomputed on `PUT` (the setting is saved
even if Redis is down), on every `users.user-state` message for the user (Kafka group
`reminders` — the location may have moved), after each firing, and — as the safety net — for every
enabled reminder at startup and every 15 minutes (`ReminderSweeper`), so any failure above (e.g. Redis
down) is fixed by the next sweep. A firing whose time already passed is skipped to next week —
except one that was still pending (the service was down), which fires late as long as candle
lighting is ahead. `DELETE` drops the job; off, no location → `next_fire_at` `null`. Needs
`REDIS_URL`, `KAFKA_BROKERS`.

## notifications

HTTP + BullMQ worker, internal-only, schema `notifications` in the shared database (push
subscriptions; `user_id` references `users.users(id)` `ON DELETE CASCADE`) plus the shared Redis
(`REDIS_URL`, its queues).
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
  progress" and the countdown are computed from the device clock against the two returned times
  (`GET /calendar/shabbat`, served by Gateway).
  - When it fetches: on Home's first mount (`locate()` for a fresh GPS fix; the persisted
    last-known location is used meanwhile), when the fix arrives, when Havdalah passes (next
    Shabbat, same location), and on Retry. Switching tabs or returning from the background doesn't
    refetch.
  - `locationSlice` persists only `coords` (`{ latitude, longitude, timeZone }`, the time zone
    from the device) and `calendarSlice` persists the last `shabbat` response, so Home still shows
    times offline. Location refused → "Location is off" + Retry (or, with a cached result, a
    "using your last known location" note).
  - **Candle-lighting reminder** — `CandleReminder`, passed as `ShabbatSection`'s `footer` (shown
    only while there are times): a bell pill reading "Remind me before candle lighting", or, while
    on, "Reminder · 1h 30m before" (amber). Signed out, it shows `ConfirmModal` ("Log in to set a
    reminder?", Yes → `/login`). Signed in, it opens a `BottomSheet` whose private form starts on
    the saved offset (else 90 min): hours 0–23 and minutes in steps of 5 (`Stepper`), presets 30m /
    1h / 1h 30m / 2h / 3h, and "Every Friday · fires at HH:MM this week" — the server's
    `nextFireAt` while the saved offset is shown ("on Fri 9 Oct" instead of "this week" once it's
    past this week's candle lighting), otherwise an estimate from Home's candle lighting
    ("first one next week" if that's already past); "We'll schedule it once we know your location"
    when the server reports `waitingForLocation`. If this browser isn't subscribed to push, a nudge
    says the reminder won't arrive here, with a Turn on link (`enableNotifications`) unless
    notifications are blocked or unsupported. Save (`PUT /reminders/shabbat-candles`, only
    `{ offsetMinutes }`) and Turn off (`DELETE`, shown only while on) close the sheet on success; a
    failure keeps it open with an `Alert`. Closing the sheet drops an unsaved offset.
- `(auth)/register` — email and password, plus optional first name, last name and phone
  (`ProfileFields`, shared with `ProfileCard`). Names accept English and Hebrew letters only, with
  single spaces between words — `sanitizeName` in `src/utils/validation.js` drops anything else
  (digits, punctuation, niqqud, other alphabets) as it's typed; the Users Service enforces the same. Phone is a country dropdown (`PHONE_COUNTRIES` in
  `src/utils/phone.js`, Israel only today) plus a digits-only local number, validated with
  `libphonenumber-js` and sent as E.164; its error shows once the field is left (or on submit).
  Blank optional fields are left out of the request.
- `(tabs)/account` — a heading and six cards (`src/components/composite/`): `ThemeCard` (light/
  dark toggle), `NotificationsCard` (see Notifications below), `AccountCard` (email; edit email/password via `POST /auth/account` — the
  `updateAccount` thunk, see `apps/users` above), `ProfileCard` (name and phone; fetches
  `GET /users/me` on mount, saves via `PATCH /users/me`, an emptied field sent as `null`),
  `LogoutCard` (confirmed in place; `authSlice`'s `logOut`), `DeleteAccountCard` (asks for the password, then
  `DELETE /auth/account` via `authSlice`'s `deleteAccount`, which signs out on success). Each card
  holds its row and its edit/confirm form as a private component in the same file, so Cancel drops
  whatever was typed. The cards render only while signed in, so signing out unmounts them — every
  form starts closed for the next session. Account is the one tab opted into
  `requiresAuth: true` (`(tabs)/_layout.js`'s `TABS`). `CustomTabBar` intercepts a press on a
  `requiresAuth` tab while signed out and shows `ConfirmModal` ("Log in to view Account?") instead
  of navigating; a direct hit on the route (deep link, web refresh, reopening the app on this tab)
  bypasses that entirely, so `AccountScreen` also calls `useRequireAuth()` on mount and renders
  `RequireAuthNotice` in that case — both are generic (`src/hooks/`, `src/components/composite/`),
  reusable by any future `requiresAuth` tab, not Account-specific.
- **Location sync** — `app/_layout.js`'s `LocationSyncManager` dispatches `profileSlice`'s
  `syncLocation` whenever the user is signed in and `locationSlice.status` is `'ready'` (a fresh
  GPS fix this session — the persisted last-known `coords` alone never trigger it).
  `syncLocation` compares the fix with the location the server already has (`GET /users/me`'s
  `location`, fetched first if the profile isn't loaded) and sends `PUT /users/me/location` only if
  the device moved more than `LOCATION_SYNC_MIN_KM` (5, haversine in `src/utils/geo.js`) or its time
  zone changed. The server's copy is the reference — there's no local "last sent" record to go
  stale across accounts or devices. One sync runs at a time; a reply that lands after sign-out
  (or a different sign-in) is dropped; a failure is simply retried on the next fix.
- **Notifications** (web build only — `pushService` reports `'unsupported'` off-web or outside a
  secure context). `frontend/public/sw.js` is exported to the site root, so its scope is `/`: on
  `push` it shows the payload's `title`/`body` with `tag` = `notificationId` (a retry duplicate
  replaces rather than doubles); a tap focuses an open app tab, else opens the payload's `url`; on
  `pushsubscriptionchange` it re-subscribes with the same key (no token there — the app re-sends
  it on its next signed-in start). `app/_layout.js`'s `PushSubscriptionManager` dispatches
  `initNotifications` at start (registers the worker, reads permission and subscription) and, once
  that's done and while signed in, `syncPushSubscription`. That syncs when the browser allows
  notifications and they weren't turned off here (`optedOut`): if the browser has no subscription
  (the browser drops it when the site is blocked, and allowing it again doesn't restore it) it
  subscribes without a prompt; then it `POST`s the subscription to `/notifications/subscriptions` —
  covers a rotated subscription and a browser last used by another user (the server upserts on
  endpoint). `watchNotificationPermission` (via `navigator.permissions`) re-runs init + sync when
  the site's permission changes while the app is open, so re-allowing needs no reload.
  - `NotificationsPrompt` (over Home): a one-time "Turn on notifications?" `ConfirmModal`, shown
    while signed in when this browser isn't subscribed, the prompt hasn't been answered here, and
    permission is `default` — or `granted` but `optedOut` (otherwise the sync subscribes by
    itself). Either answer sets `promptDismissed`; "Not now" also sets `optedOut`.
  - `NotificationsCard` (Account): this browser's switch — on, off, blocked (a warning `Alert`
    pointing to the browser's site settings) or not supported. Re-runs `initNotifications` on
    mount, to pick up a permission changed in the browser meanwhile.
  - `enableNotifications` must be dispatched straight from the tap — `requestPermission` is its
    first await, since browsers only prompt during a user gesture; then VAPID key → `subscribe` →
    `POST`. `disableNotifications` (this browser only) sends a best-effort `DELETE {endpoint}` and
    then unsubscribes the browser; if the `DELETE` failed, the push service's 410 makes the server
    drop the row on the next send.
  - `authSlice`'s `logOut` (`LogoutCard`) and a successful `deleteAccount` run
    `disableNotifications({ loggingOut: true })` before clearing the session (it also re-arms the
    prompt, so the next person here is asked); a session that merely expires (`AuthGate`
    → `clearAuth`) keeps the subscription, so reminders still arrive while signed out.
  - `notificationsSlice` (`{ permission, subscribed, ready, busy, error, promptDismissed,
    optedOut }`) persists only `promptDismissed` and `optedOut` (set by turning the switch off,
    "Not now" or log-out; cleared by a successful enable); the rest is read from the browser on
    every start. It doesn't import `authSlice` (that one imports it), so it reads the token from
    `getState()`.
- **Session ended** — `httpClient`'s `authorizedFetch` (every signed-in HTTP call) passes the
  token to the handler set with `setUnauthorizedHandler` on any `401`. `src/store/index.js`
  registers it: if that token is still `authSlice.accessToken` (a late answer for an older token is
  ignored), `clearAuth({ notice: SESSION_ENDED_NOTICE })`. `AuthGate` pushes to `/login` once when
  a notice appears — not on later navigation, so leaving login sticks — and the login screen shows
  it as a warning `Alert`. The notice (not persisted) is cleared by Register, "Continue without
  logging in", unmounting login, and a successful login/register. Expiry (`AuthGate`'s timer) and
  Log Out sign out with no notice. Other errors (e.g. `500`) keep the session.
- `profileSlice` (`{ profile, status, error, locationSyncing }`) isn't persisted; it's fetched when
  `ProfileCard` mounts or a sync needs it, and reset on `clearAuth` and a successful
  `deleteAccount` so one user's profile is never shown to the next.
- `remindersSlice` (`{ candles, saving, error }` — `candles` is the `shabbat_candles` reminder or
  `null`) isn't persisted either; `CandleReminder` fetches `GET /reminders` whenever an access
  token appears, and it's reset on `clearAuth` and a successful `deleteAccount`. Turning off keeps
  the offset (the server does too), so the sheet reopens on it.

Talks only to Gateway (`EXPO_PUBLIC_GATEWAY_ORIGIN`, baked in at build time, required —
`src/config/urls.js` throws at load if it's unset) — never the Users Service or any other backend
service directly.

Themed via a three-layer pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`) and shared
components under `src/components/base/` (grouped into `background`/`buttons`/`feedback`/`form`/
`layout` subfolders by purpose) and `src/components/composite/` (the Account cards above,
`AmbientBackground`, `CandleReminder`, `ConfirmModal`, `NotificationsPrompt`, `ProfileFields`,
`RequireAuthNotice`, `ShabbatSection`) — see `.claude/agents/frontend.md` for the base/composite split, the full
convention, and why there's no Gluestack layer here.

`src/services/` is split by transport: `http/` (fetch-based calls — `authService`,
`usersService` for `/users/me*`, `remindersService` for `/reminders*`, `notificationsService` for
`/notifications/*`), `ws/`
(`socketService`, a single shared Socket.IO connection), and `device/` (`locationService` —
`expo-location` permission + position, plus the device's IANA time zone; `pushService` — the
browser's service worker, `Notification` permission and `PushManager`). `wsSlice`'s `connectWebSocket`/
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
`JwtAuthGuard` (any role in `USER_ROLES`), `AdminGuard` (`JwtAuthGuard` + admins only → `403`; not
used by any route yet), and the `CurrentUser` param decorator. Used by both `apps/users` (signs, on
login/register) and `apps/gateway` (verifies — `JwtAuthGuard` on `/users/me*`, `/reminders*`,
`/notifications/subscriptions`). Also `USER_ID_HEADER` + `@ForwardedUserId()`, the
internal-service side of Gateway's forwarded user id (see Gateway above) — used by `apps/users`,
`apps/reminders` and `apps/notifications`.

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
`notification-requested` (Reminders → Notification Service) and `reminder-due` (Reminders' own
delayed jobs).
Also `notificationRequestedPublishOptions(message)`, the dedupe/retry options every publisher of
that queue must pass. See `event-schemas.md`.

## libs/jewish-calendar

All of the project's Jewish-calendar maths, in one place (it was a separate Calendar Service).
`@hebcal/core` v6 behind `ICalendarCalculator` (`HebcalCalendarCalculator` is the only file that
imports it); `ShabbatCalendar` (`IShabbatCalendar`) is the entry point, pure and synchronous.
Used in-process by Gateway (`GET /calendar/shabbat`, Home) and the Reminders scheduler — so Home
and reminders always agree, and a rule changes in one place.

- `current(location, now)` — the Shabbat in progress at `now`, otherwise the next one: candle
  lighting, Havdalah, parasha, holidays, `isNow`. The Shabbat that started last Friday is returned
  while it's still running — including through a Yom Tov directly after it (abroad, `havdalah` can
  be Sunday or Monday night). `parasha` is `null` when a holiday replaces the weekly reading;
  `holidays` lists what falls on that Saturday, minus eves, modern civic days and Leil Selichot.
  Names come in English and unvoweled Hebrew.
- `nextCandleLighting(location, after)` — the first Friday candle lighting strictly after `after`.
  Weeks with no sunset are skipped; throws `UnprocessableEntityException` (`422`) only after 26
  such weeks in a row (or from `current` when this week has none).
- Rules, for both: "today" is the user's local date in `timeZone`, never the server's. Israel vs.
  abroad (one- vs. two-day Yom Tov) follows `timeZone === 'Asia/Jerusalem'`. Candle lighting is
  20 min before sunset in Israel — 40 in Jerusalem and Petach Tikva, 30 in Haifa, Tzfat and Zikhron Ya'akov (OU Israel / MyZmanim), matched by distance from the city center — and 18 abroad (`israel-city-customs.ts`; the radius is approximate, so a town
  right next to a city can count as it). Havdalah is Hebcal's default (sun 8.5° below the horizon).

See `backend/libs/jewish-calendar/README.md` for the non-obvious implementation details (ESM-only
import, server time zone, finding Havdalah).

## libs/users-schema

The Users Service's tables as other services may see them: read-only TypeORM entities
(`synchronize: false`, so a service that lists them never creates or alters them) —
`UsersUserEntity` (`users.users`, id only; the target of other services' `ON DELETE CASCADE`
foreign keys) and `UsersProfileEntity` (`users.profiles`, location columns; read by Reminders). Only
the Users Service writes these tables; its own full entities stay in `apps/users`.

## libs/kafka-contracts / libs/kafka-client

Kafka is for events (a fact any number of services may react to); BullMQ above is for jobs. The
Users Service publishes (through the outbox); Reminders and Notifications start consuming in plan
tasks 2.9/2.10.

`kafka-client` (the only code that imports `kafkajs`, via `KAFKA_BROKERS`):
`IEventPublisher`/`KafkajsEventPublisher` (`publish(topic, key, message | null)`; `null` is a
tombstone; idempotent producer, one request in flight, so a key's messages keep their order;
connects on first publish, so a service starts while Kafka is down) and
`IEventConsumer`/`KafkajsEventConsumer` (`subscribe(topic, guard, handler)`, one consumer group per
service, starts on `onApplicationBootstrap` reading from the beginning for a new
group, connecting in the background and retrying with a delay doubling from 1 s to 60 s; a message
failing the guard is logged and skipped, a tombstone skipped silently, a
handler that throws is retried). The outbox: `addOutboxEvent(manager, topic, key, payload)` saves an event in the caller's
TypeORM transaction (`outbox_events`, `OutboxEventEntity` — add it to the service's entities), and
`OutboxRelay` (over `TypeOrmOutboxStore` + the publisher) publishes saved events in order and
deletes each once Kafka has it — on startup and on `notify()` after a commit, retrying a failure
with a delay doubling from 1 s to 60 s. No polling. At-least-once: a crash between publish and
delete re-sends one, so consumers must be idempotent.
`kafka-contracts`: `KAFKA_TOPICS`, `KAFKA_CONSUMER_GROUPS`, and each message type with its guard.
See `event-schemas.md`.
