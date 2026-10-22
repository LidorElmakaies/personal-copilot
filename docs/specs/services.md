# Services

Four NestJS apps in `backend/apps/` (`gateway`, `users`, `reminders`, `notifications`),
shared libs in `backend/libs/`, one frontend. See `architecture.md` for the topology diagram.

## gateway

The only backend service reachable from outside the Docker network — directly over Tailscale, or
(in the cloud/Hetzner deployment — see `architecture.md`'s "System topology") indirectly via an SSH
tunnel from a Caddy instance on the public internet. HTTP + WebSocket.

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/account`,
  `DELETE /auth/account` → the Users Service route of the same name, body untouched. No guard on any of them (for
  the first four, that's how you get a token in the first place; `account` is body-driven the same
  way — see [users](#users)).
- `GET /users/me`, `PATCH /users/me`, `PUT /users/me/location` (`JwtAuthGuard`) → Users Service's
  routes of the same name. Body relayed untouched.
- `GET /notifications/vapid-public-key` (open), `POST`/`DELETE /notifications/subscriptions` and
  `PUT`/`DELETE /notifications/fcm-devices` (`JwtAuthGuard`) → Notification Service's routes of the
  same name. Body relayed untouched.
- `GET /reminders`, `PUT /reminders/shabbat-candles`, `DELETE /reminders/shabbat-candles`, and
  `GET`/`POST /reminders/custom`, `GET /reminders/custom/preview`, `PATCH`/`DELETE
  /reminders/custom/:id`, `POST /reminders/custom/:id/skip` (`JwtAuthGuard`) → Reminders Service's routes of the same name.
  Body relayed untouched. **Not called by the app**, which keeps both kinds of reminder on
  the phone (see [frontend](#frontend)).
- Every forwarded route above (`/auth/*`, `/users/me*`, `/reminders*`, `/notifications/*`) is one
  row of `PROXY_ROUTES` (`src/proxy/proxy.routes.ts`): method, path (the same on Gateway and the
  service; a `:param` is filled in from the request, URL-encoded so it stays one path segment, and
  a `GET`'s query string is passed on as sent — `api/forwarded-path.ts`), target service, `auth: 'user'` (`JwtAuthGuard` + `X-User-Id`) or `'none'`, and
  `throttle: 'strict'` where it applies. `ProxyController` turns each row into its own Nest route,
  so anything unlisted is a `404` — never a wildcard. `ProxyService` sends it through that service's
  `ServiceHttpClient` (base URL from `<SERVICE>_SERVICE_URL`); an unreachable service answers
  `502 { error: { code: '<service>_unreachable', message } }`. Adding a route is one row there,
  plus the same row in `test/proxy.api.spec.ts`'s `CONTRACT`.
- **User identity for internal services:** a guarded route forwards only the token's user id, in
  an `X-User-Id` header Gateway sets itself (`USER_ID_HEADER` in `@app/auth-kernel`). Client
  headers are never passed through, so a client can't supply its own. The internal service reads
  it with `@ForwardedUserId()` (401 if absent) and trusts it because only Gateway can reach it, so
  no internal service needs `JWT_SECRET`.
- `GET /calendar/shabbat?lat&lon` — **served by Gateway itself, not proxied** (`src/calendar/`):
  the Shabbat in progress, otherwise the next one, for that location, computed in-process with
  [`@app/jewish-calendar`](#libsjewish-calendar). With `/calendar/month`, the only Gateway routes
  with logic of their own — the maths is the shared lib, so there's nothing for another service to
  add. Unguarded. **Not called by the app**: it computes the same answer on the phone
  (`calendarService`).
  ```json
  { "candleLighting": "2026-10-02T15:04:00.000Z", "havdalah": "2026-10-03T16:00:00.000Z",
    "parasha": null, "holidays": [{ "en": "Shmini Atzeret", "he": "שמיני עצרת" }], "isNow": false }
  ```
  `lat`/`lon` validated as coordinates → `400` otherwise; any other parameter (e.g. an older
  client's `tz`) is dropped. Israel's rules and time zone apply wherever the point is (see
  [`libs/jewish-calendar`](#libsjewish-calendar)). `422` where there's no sunset to count from
  (e.g. polar summer).
- `GET /calendar/month?year&month&lat&lon` — served by Gateway itself the same way, unguarded (and
  likewise not called by the app):
  every day of that civil month — its Hebrew date, holidays/fasts (`kind`: `yomTov` | `fast` |
  `holiday`), Saturday's parasha, and its enter/leave times (`candleLighting` | `havdalah` |
  `fastBegins` | `fastEnds`, on the day each happens; Yom Kippur's are `fastBegins` at its eve's
  candle lighting and `fastEnds`, not `havdalah`). Same location validation, plus `year`
  1900–2200 and `month` 1–12 → `400` otherwise. Never `422`: a day with no sunset just has no times.
  ```json
  { "year": 2026, "month": 9, "days": [ …, { "date": "2026-09-21",
      "hebrew": { "day": 10, "dayHe": "י׳", "month": { "en": "Tishrei", "he": "תשרי" },
                  "year": 5787, "yearHe": "תשפ״ז" },
      "events": [{ "kind": "yomTov", "name": { "en": "Yom Kippur", "he": "יום כיפור" } }],
      "parasha": null, "times": [{ "kind": "fastEnds", "at": "2026-09-21T16:15:00.000Z" }] }, … ] }
  ```
- `GET /admin/status` (`AdminGuard`, `src/admin/`) — **answered by Gateway itself**: its own
  [`buildInfo`](#libsbuild-info) read in-process, plus each internal service's `/health` (Users,
  Reminders, Notifications — the same `*_SERVICE_URL`s the proxies use), asked in parallel with a
  timeout (`ADMIN_STATUS_TIMEOUT_MS`, default 2000). No answer, a non-200 or a body without
  `status: 'ok'` → `down`, never an error. `Cache-Control: no-store`. Gateway first:
  ```json
  [{ "service": "gateway", "status": "up", "version": "0.1.0", "builtAt": "…", "startedAt": "…", "latencyMs": null },
   { "service": "reminders", "status": "down", "version": null, "builtAt": null, "startedAt": null, "latencyMs": null }]
  ```
- `src/realtime/` — the app's live connection.
  - `POST /realtime/device` (open; `authStrictThrottlePolicy`) → `201 { device_token }`: a new
    device id, signed by `@app/auth-kernel`'s `DeviceTokenService` (`{ sub, typ: 'device' }`, no
    expiry). Each app install fetches one once and keeps it. A device token is never accepted as a
    user token, nor the reverse.
  - Socket.IO at path `/ws`. Handshake `auth.deviceToken` is required; `auth.token` (the access
    token) is added once signed in, verified the same way as the HTTP guard. A Socket.IO middleware
    refuses before connecting, with `connect_error` messages `device_token_invalid` (missing or
    not a device token) or `token_invalid` (a login token that fails). No login token → an
    anonymous connection that gets broadcasts only.
  - One connection per device: a newer one from the same device closes the previous at once (a
    phone that switched networks reconnects before its old connection would time out). So a
    client holds as many connections as it has device tokens, which the rate limit on
    `POST /realtime/device` bounds — HTTP's limiter doesn't otherwise see WS.
  - A feature module imports `RealtimeModule` and injects `IRealtimeConnectionService`:
    `pushToUser(userId, event, payload)` — to every device the user is signed in on; returns
    `false`, not an error, if none — and `broadcast(event, payload)` — to every open connection,
    signed in or not; returns how many.

  In-memory connection store, single Gateway replica only (this
  project's actual scale) — a Redis-backed store (Socket.IO's official Redis adapter) is the
  upgrade path if that ever changes.

  Events sent today:

  | Event | To | Payload | Sent when |
  |---|---|---|---|
  | `app-update` | `broadcast` | `{}` | a new Android release is published (below) |
- `src/app-update/` — no routes. `FrontendReleaseConsumer` (Kafka `frontend.releases`, group
  `gateway`) → `AppUpdateNotifierService` broadcasts `app-update`. No version in the payload —
  Gateway's public surface never exposes versions; the app re-reads `latest.json` itself. See
  `event-schemas.md#frontendreleases`.
- Rate limiting (`@nestjs/throttler`): a global limit (`THROTTLE_TTL_MS`/`THROTTLE_LIMIT`, default
  60 s/100) on every route, plus a strict one (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`,
  default 60 s/5) on `register`/`login`/`refresh`/`account` (both methods) and `/realtime/device`.
  `logout`, `/calendar/*`, `/notifications/*`, `/reminders*` and `/users/me*` stay on the global
  one. Why two tiers: `backend/apps/gateway/README.md`. Keyed on client IP: `main.ts` sets
  `trust proxy` to `src/trust-proxy.ts`'s `TRUST_PROXY` (loopback + private networks — safe
  because the port is published on `127.0.0.1` only), so that IP is the one `tailscale serve` or
  the SSH tunnel forwarded — see `architecture.md`.
- CORS is permissive (`origin: true`, reflects any origin) on both HTTP and the WS handshake — why
  that's safe: `backend/apps/gateway/README.md`.
- No `/health`, and versions only behind `AdminGuard` (`GET /admin/status`) — Gateway is the
  public entry (including the cloud path). Its image bakes in its version like the others (see
  [Versions](#versions)).

## users

HTTP, internal-only (only Gateway calls it), schema `users` in the shared database. Owns both how
you log in (`users`, `refresh_tokens`) and who you are (`profiles`), and publishes profile changes
and deletions on Kafka (see "Profiles" below).

- `POST /auth/register` — `{ email, password, firstName?, lastName?, phone? }` →
  `{ access_token, refresh_token }`. The optional details go into the profile, created in the same
  transaction as the account.
- `POST /auth/login` — same shape.
- `POST /auth/refresh` — `{ refresh_token }` → new `{ access_token, refresh_token }` (rotates; the
  old refresh token is revoked regardless of outcome).
- `POST /auth/logout` — `{ refresh_token }` → revokes it.
- `POST /auth/account` — `{ email, currentPassword, newEmail?, newPassword? }` → fresh
  `{ access_token, refresh_token }`. Verifies `currentPassword` the same way `login` verifies a
  password, then applies whichever of `newEmail`/`newPassword` is present in one transaction
  (`newEmail` taken by another account → `409 Conflict`, same as `register`; `newPassword` hashed
  the same way as at registration, and it revokes every refresh token the user has, so every other
  session ends at its next refresh — within 15 min, as its access token expires — while the caller
  carries on with the returned pair). Throws `400 Bad Request` if neither field is set. One endpoint covering
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
- `GET /users/me` → `{ firstName, lastName, phone, location: { lat, lon, updatedAt } | null }`
  (user from `X-User-Id`); `404` for a user that no longer exists.
- `PATCH /users/me` — any of `{ firstName, lastName, phone }`; only the fields sent change, `null`
  clears one, none at all → `400`. Names are trimmed, 1–100 chars, English or Hebrew letters only with single spaces between words
  (`NAME_PATTERN` in `@app/kafka-contracts`, also applied by register); `phone` in international format
  (`+972501234567`). Returns the profile.
- `PUT /users/me/location` — `{ lat, lon }` → the profile. The frontend sends it only after a move
  of more than 5 km (see [frontend](#frontend)); `updatedAt` is set here.
- `GET /health` — see [Versions](#versions).

**Profiles.** `profiles` table, keyed by `user_id` (the user's id and a foreign key, deleted with
the user): `first_name`, `last_name`, `phone`, `lat`, `lon`, `location_updated_at`,
`version`. Every write locks the row, bumps `version`, and saves the full state as a
`users.user-state` event in the same transaction (the outbox, see `libs/kafka-client`), so a change
is never published without being saved or saved without being published. Every account has one
from the moment it's created (`register` and the admin seed make both in one transaction). A write
for a user that no longer exists answers `404` and creates nothing: account deletion removes the
profile row first, so a write either finishes before it or finds nothing.

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
plaintext). Access tokens: 15-min TTL, `{ sub, role, email }` payload; refresh tokens: 30 days,
rotated on every use. `UserRole` is
`'user' | 'admin'` (`USER_ROLES` in `@app/auth-kernel`); `register` always creates `'user'`. The
only `'admin'` is the one `AdminSeedService` creates once at boot from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
(see `docs/users/environment.md`). `JsonWebTokenService.verify` accepts any role in `USER_ROLES`
(anything else → unauthenticated), so the admin signs in and uses every `JwtAuthGuard` route and the
WS handshake like any user. `AdminGuard` (same lib) is `JwtAuthGuard` plus `role === 'admin'`: no or
a bad token → `401`, a non-admin → `403 Admins only`. Used by Gateway's `GET /admin/status`.

An email is unique by the `users.email` constraint alone: `register` and `account` write and turn a
duplicate-key error into `409`, with no lookup first, so two requests for one email at the same
moment can't both pass a check.

Refresh tokens are stored as a plain SHA-256 hash (no salt/pepper) — sufficient since a refresh
token is already a high-entropy random value, not human-guessable like a password, so this only
guards against a raw DB leak, not brute force. `refresh` always revokes the used token first, then
issues a new pair, so a stolen-and-replayed refresh token only ever works once.

## reminders

HTTP + BullMQ worker, internal-only, schema `reminders` in the shared database plus the shared
Redis (`REDIS_URL`) and Kafka (`KAFKA_BROKERS`). Owns two kinds of reminder: the candle-lighting
reminder and the user's own (custom) reminders, and turns each into a notification at its time.
User from Gateway's `X-User-Id` (`@ForwardedUserId()`, 401 without it). **Not called by the
app** (it keeps reminders on the phone); the reminders already saved here keep firing until
they're removed.

- `GET /reminders` → the caller's reminders, enabled or not:
  `[{ type, offsetMinutes, enabled, nextFireAt, waitingForLocation }]`. `waitingForLocation` is
  `true` until the user's location is known (see below) — the reminder is saved, but can't fire.
- `PUT /reminders/shabbat-candles` — `{ offsetMinutes }` → the saved reminder. Turns it on, or
  updates it. `offsetMinutes` is a whole number 1–1440 → `400` otherwise. Any `lat`/`lon` sent
  is ignored: the location comes from the user's profile.
- `DELETE /reminders/shabbat-candles` → `204`. Turns it off but keeps the row, so the settings can
  prefill the sheet next time. Idempotent.
- `GET /reminders/custom?from=YYYY-MM-DD&to=YYYY-MM-DD` → each of the caller's own reminders,
  oldest first, with the days it falls on in that range (both included; `from` ≤ `to`, at most 400
  days, else `400`): `[{ id, title, hour, minute, repeat, calendar, start, skipped, dates }]` — the
  days from `ReminderOccurrences` ([libs/jewish-calendar](#libsjewish-calendar)).
- `POST /reminders/custom` — `{ title, hour, minute, repeat, calendar?, start }` → `201` and the
  reminder (`calendar` defaults to `gregorian`, `skipped` starts empty). `title` 1–60 characters
  after trimming: English or Hebrew letters, digits and `. , ' ! ? : ( ) " & / -`, single spaces
  between words; `hour` 0–23, `minute` 0–59; `repeat` `once`/`daily`/`monthly`/`yearly`;
  `calendar` `gregorian`/`hebrew`; `start` a real `YYYY-MM-DD` date — `400` otherwise. At most 300
  per user (`MAX_REMINDERS_PER_USER`) → `422`.
- `PATCH /reminders/custom/:id` — any of those fields → the reminder (the whole series); none
  (`from`/`to` alone included) → `400`. `DELETE /reminders/custom/:id` → `204`.
- `POST /reminders/custom/:id/skip` — `{ date }` → `200` and the reminder with `date` in `skipped`
  ("only this day"; changing one day is this plus a once-reminder on it). Idempotent; `422` if the
  reminder doesn't fall on `date`, or past 500 skipped days.
- `POST /reminders/custom`, `PATCH /reminders/custom/:id` and `POST /reminders/custom/:id/skip`
  also take optional `from`/`to` (`YYYY-MM-DD`) in the body — the months the client shows, both
  or neither, under the same rules as the list's range, else `400`. With them the answer also has
  `dates` (the reminder's days in that range), so the client can show the change without asking
  for the list again; without them it doesn't. They're in the body because Gateway passes a query
  string on only for a `GET`.
- A `:id` that isn't the caller's reminder, or isn't a UUID → `404`.
- `GET /reminders/custom/preview?hour&minute&repeat&calendar&start` — the same timing fields
  (same rules, `calendar` defaults to `gregorian`, `hour`/`minute` plain digits — `''` or `1e1` →
  `400`) → `{ next: ['YYYY-MM-DD', …] }`: the next 3 days
  (`PREVIEW_COUNT`) it would fire on, as if saved now, in Israel time; empty when it won't fire
  again (a once-reminder whose time passed). Nothing is saved — the add/edit sheet's "Next" dates.
- `GET /health` — see [Versions](#versions).

**Tables.** `reminders`: one row per user and type (`user_id`, `type`, `offset_min`, `enabled`,
`next_fire_at`; unique `(user_id, type)`); the only type is `shabbat_candles`. `custom_reminders`:
`title`, `hour`, `minute`, `repeat`, `calendar`, `start_date` `date`, `skipped_dates`
`varchar(10)[]`, `next_fire_at`, `created_at`, `updated_at`. In both, `user_id` references
`users.users(id)` `ON DELETE CASCADE`, so a deleted account's reminders go with it and a reminder
can't be saved for a user that doesn't exist.

**The user's location** is read straight from the Users Service's `users.profiles` (a read-only
mapping, `UsersProfileEntity` from `@app/users-schema`) — never copied, never written here. Only
candle lighting uses it.

**Scheduling.** Every reminder with a next firing has it in `next_fire_at` and one delayed
`reminder-due` job for exactly that time; when the job runs it requests the notification and queues
the next firing — what each kind sends: [event-schemas.md](event-schemas.md#reminder-due).
`ReminderDueConsumer` hands each job to its scheduler by `kind`. As the safety net,
`ReminderSweeper` reschedules every enabled candle-lighting reminder and every custom reminder at
startup and every 15 minutes, so a failure anywhere below (e.g. Redis down — a save still
succeeds) is fixed by the next sweep. It then removes delayed jobs whose reminder row is gone
(`ReminderJobCleaner`) — an account deletion takes the rows by cascade, so nothing cancelled
their jobs. Only a missing row counts: a row is saved before its job is queued, so a reminder
being created is never taken for one.

- **Candle lighting** (`ReminderScheduler`): an enabled reminder with a location fires at the next
  candle lighting there (`@app/jewish-calendar`, in-process) minus the offset. Recomputed on `PUT`,
  on every `users.user-state` message for the user (Kafka group `reminders` — the location may have
  moved) and after each firing. A firing whose time already passed is skipped to next week — except
  one that was still pending (the service was down), which fires late as long as candle lighting is
  ahead. `DELETE` drops the job; off, or no location → `next_fire_at` `null`.
- **Custom** (`CustomReminderScheduler`): fires at its next occurrence
  (`ReminderOccurrences.nextAfter`, skipped days left out) at its wall-clock time in Israel
  (`ISRAEL_TIME_ZONE`) — the location plays no part, so it's scheduled even without one.
  Recomputed on `POST`, `PATCH`, skip and after each firing; `users.user-state` doesn't affect it.
  `DELETE` drops the job (best effort — a leftover finds the reminder gone and does nothing). A
  firing that passed without running (the service was down) is kept while the reminder still falls
  then and it's less than an hour late (`LATE_LIMIT_MS`), so it fires late; past that, the next
  occurrence is scheduled instead — a job that failed every attempt keeps its id in Redis, so
  re-adding it would do nothing. A once-reminder that has fired keeps its row with `next_fire_at`
  `null`.

## notifications

HTTP + BullMQ worker, internal-only, schema `notifications` in the shared database (browsers' push
subscriptions and the Android app's FCM devices; each `user_id` references `users.users(id)`
`ON DELETE CASCADE`) plus the shared Redis (`REDIS_URL`, its queues).
Stores browsers' Web Push subscriptions and Android devices, and delivers `notification-requested`
jobs to them. Publishers decide *what* and *when*; this service decides *how* (one
`INotificationChannel` adapter per channel — `WebPushChannel` and `FcmChannel`).

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
- `PUT /notifications/fcm-devices` — `{ token, key }` → `204`: the Android app's FCM registration
  token (`[A-Za-z0-9_:-]`, ≤ 4096) and the 256-bit key it decrypts its notifications with (base64,
  exactly 32 bytes), made on the phone. Upsert on `token`: the same phone moves to whoever is
  signed in now, with the key it sends now.
- `DELETE /notifications/fcm-devices` — `{ token }` → `204`, removed only if it belongs to the
  caller; idempotent.
- The current app calls none of these routes (its reminders fire on the phone, see
  [Frontend](#frontend)); subscriptions and devices already stored keep receiving.
- The subscription and device routes take the user from Gateway's `X-User-Id` (see Gateway above),
  `401` without it.
- `GET /health` — see [Versions](#versions).

`push_subscriptions` table: `id`, `user_id` (indexed), `endpoint` (unique), `p256dh`, `auth`,
`created_at`. `fcm_devices` table: `id`, `user_id` (indexed), `token` (unique), `key`, `created_at`,
`updated_at`. VAPID keys come from `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`; the
service refuses to boot without them. The FCM sending key (`FCM_*`) is optional: without it the
FCM channel is off (a warning at boot) and devices are still registered (see
`docs/notifications/environment.md`). Tokens and keys are never logged.

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
- **Android (`FcmChannel`).** Same shape as Web Push: the user's *current* devices, minus those
  marked done (`fcm:<deviceId>`). Each gets a high-priority **data-only** FCM message (HTTP v1,
  `fcm.googleapis.com`) whose `data` is `{ v: '1', enc }`: `enc` = base64 of iv (12 bytes) |
  ciphertext | tag (16) — AES-256-GCM of `{ notificationId, title, body, url?, expiresAt }` with that
  device's key, so Google only carries ciphertext. Android TTL = whole seconds left. The app's
  background task decrypts and shows it — open, in the background, swiped away or in Doze (proven
  on a phone). Access tokens come from the service-account key (an RS256 JWT
  exchanged at `oauth2.googleapis.com`), cached until a minute before they expire. FCM's answer:
  sent → done; `UNREGISTERED`/404, `SENDER_ID_MISMATCH` or a 400 about the registration token →
  device deleted, done; 429, 5xx, 401 (a fresh access token next time) or no response → left
  undone, retried like Web Push; anything else (or a stored key that isn't 32 bytes) → logged,
  done.
- **Push service answer, per device.** Sent → marked done. 404/410 → subscription deleted, marked
  done. 429, 5xx, a network error (`ECONNREFUSED`, `ETIMEDOUT`, …) or web-push's timeout → left
  undone. Any other failure (other 4xx, unusable keys) → logged, marked done, not retried. If any
  device was left undone, the channel throws `RetryableDeliveryException` after trying the rest and
  BullMQ retries the job (8 attempts, exponential backoff from 30 s — about an hour in total, cut
  short by `expiresAt`). A failing database call also throws, so it's retried too.

Nothing about a notification is stored beyond its jobs: BullMQ keeps completed jobs for 24 h and
failed ones for 7 days (inspect with `docker compose exec redis redis-cli` from `devops/`, under the
`bull:notification-requested:*` keys).

## frontend

Expo Router app. Login is optional app-wide, not a gate on the whole app: `(tabs)` routes are
reachable while signed out, and `(auth)/login`/`(auth)/register` each add a "Continue without
logging in" link (routes to `/`) for whoever lands there without wanting to authenticate.

The tabs are a swipeable row (`SwipeTabs` over `TabPager`, `(tabs)/_layout.js`): drag sideways
anywhere on a screen to the next or previous tab in the bar's order — the screen follows the finger,
past a quarter of the width or a flick slides on in 250 ms, otherwise it springs back, and past the
first or last tab it only stretches a little. A tap on the bar runs the same slide (a jump of more
than one tab starts from the tab next to the target). A drag starting within 20 dp of either side is
left to Android's back gesture; on the Calendar, a drag on the month grid moves months instead
(`SwipePager` blocks the tab pan). A tab mounts when it's shown or next to the one shown, then stays
mounted. Admin is in the order only for admins; on a direct `/admin` link a non-admin sees that
screen over the row with the swipe off.

- `(tabs)/index` (Home — the landing tab, no session required: live clock, today's Gregorian date,
  and today's Hebrew/Jewish date via `@hebcal/hdate`, chosen over `Intl`'s `'he-u-ca-hebrew'`
  calendar extension because Hermes's bundled ICU data isn't guaranteed to include non-Gregorian
  calendar tables on-device — see `frontend/README.md`). Under the clock, `ShabbatSection` shows the current/next Shabbat for
  the device's location: a label (holiday or parasha, or "Shabbat Shalom" while it's in progress),
  candle lighting and Havdalah with their dates, and a countdown to whichever comes next. "In
  progress" and the countdown are computed from the device clock against the two returned times
  (`calendarService.getShabbat`, computed on the phone from `src/lib/jewish-calendar` — no network,
  so it works offline; the same answer `GET /calendar/shabbat` gives, times as ISO strings).
  - When it computes: on Home's first mount (`locate()` for a fresh GPS fix; the persisted
    last-known location is used meanwhile), when the fix arrives, when Havdalah passes (next
    Shabbat, same location), and on Retry. Switching tabs or returning from the background doesn't
    refetch.
  - `locationSlice` persists only `coords` (`{ latitude, longitude }`) and `calendarSlice` persists the last `shabbat` response, so Home still shows
    times offline. Location refused → "Location is off" + Retry (or, with a cached result, a
    "using your last known location" note).
  - **Candle-lighting reminder** — `CandleReminder`, passed as `ShabbatSection`'s `footer` (shown
    only while there are times): a bell pill reading "Remind me before candle lighting", or, while
    on, "Reminder · 1h 30m before" (amber); no login needed. It opens a `BottomSheet` whose private form starts on
    the saved offset (90 min until one is saved): hours 0–23 and minutes in steps of 5
    (`Stepper`), presets 30m / 1h / 1h 30m / 2h / 3h, and "Every Friday · fires at HH:MM this
    week" — Home's candle lighting minus the offset ("first one next week" if that's already
    past); "We'll schedule it once we know your location" for the saved offset while the phone has
    no `location.coords`. Unless notifications are allowed (`permission` `granted`), a nudge says
    the reminder won't arrive here, with Turn on (`enableNotifications`) while Android can still
    ask, Open settings (`openNotificationSettings`) once it's `denied`, nothing when unsupported
    (the web build). Save (`saveCandleReminder`) and Turn off (`turnOffCandleReminder`, shown only
    while on) are local and close the sheet. Closing the sheet drops an unsaved offset. Each change
    reschedules its notifications (see Reminder notifications below).
- `(auth)/register` — email and password, plus optional first name, last name and phone
  (`ProfileFields`, shared with `ProfileCard`). Names accept English and Hebrew letters only, with
  single spaces between words — `sanitizeName` in `src/shared/utils/validation.js` drops anything else
  (digits, punctuation, niqqud, other alphabets) as it's typed; the Users Service enforces the same. Phone is a country dropdown (`PHONE_COUNTRIES` in
  `src/features/account/utils/phone.js`, Israel only today) plus a digits-only local number, validated with
  `libphonenumber-js` and sent as E.164; its error shows once the field is left (or on submit).
  Blank optional fields are left out of the request.
- `(tabs)/calendar` — no session required: a month grid (`MonthHeader`, `WeekdayRow`, then
  `MonthGrid` pages in `SwipePager`; `MonthStatus` under it when location or the month fails;
  presentational) for the device's location (`calendarSlice.fetchMonth` → `calendarService.getMonth`,
  computed on the phone like Home's times — the same answer as `GET /calendar/month`; not persisted). Opens on the device's current month. A sideways drag moves the month with the
  finger (vertical still scrolls); let go past a quarter of the width or with a flick and it slides
  on (~250 ms), else springs back; a held drag runs through as many months as it covers, the title
  following the month mostly in view; ‹ › run the same slide, and quick taps add up. A "Today"
  pill in the header, shown whenever another month or day is in view, slides back to this month (a
  far jump starts one month short and slides one) and selects today. The month landed on is fetched
  first, then the one either side (`calendarSlice.loadMonthsAround`), so a swipe lands on a month
  already filled in (drawn complete, no fade; `SwipePager` keeps two built either side, the
  header's Hebrew title follows the month in view); one not loaded yet shows its day numbers
  (`placeholderDays`) and only then do its Hebrew dates and dots fade in when it answers. Fetched months are kept by month for the current place
  (location rounded to ~1 km; a move clears them), each fetched once, pruned to those near the
  month shown. Weeks start on
  Sunday; each day shows its date, its Hebrew day, and a dot — `error` color for a fast, `accent`
  for any other holiday; Friday and Saturday dates in `pending` (amber), today outlined (and
  "today" in its accessibility label). Under the title: the Hebrew months the month spans and the
  year it ends in. Opened straight to this tab, it asks for the location itself (Home normally
  does); location refused → "Location is off" + Retry, as on Home; location or month failing →
  "Couldn't load this month." + Retry. Below the month, `DayCard` (presentational) shows the selected
  day — today on opening, the 1st after ‹ ›, or the day tapped (filled `accent`): its weekday and
  date, Hebrew date, its events' names in English and Hebrew (else Shabbat / Erev Shabbat / the
  weekday), Today / Yom Tov / Fast chips, Saturday's parasha, and its times (candle lighting in
  `pending`; a fast starting with candle lighting is one row, "Candle lighting · fast begins"),
  or "No candle lighting or fast times"; dimmed while a swipe is between months.
  **Your reminders** (no login needed): kept on the phone — `customRemindersSlice`'s `items`, each a
  definition `{ id, title, hour, minute, repeat, calendar, start, skipped, changed }` — `changed`
  maps a day (`YYYY-MM-DD`) to its own `{ title, hour, minute }` (`{}` on create; create and update
  can't set it). On every month change
  the tab sets `range` (`setRemindersRange`) to the month shown ± `PRELOAD` (1, exported by
  `calendarSlice`; `remindersRange` in `src/features/reminders/utils/customReminders.js`), and the
  `selectDayReminders` selector works out each definition's days in it
  (`src/features/reminders/utils/occurrences.js`, over `src/lib/jewish-calendar`'s
  `ReminderOccurrences`, Israel time; cached per definition, so a change recomputes only that
  one) as `{ date: [{ id, title, hour, minute, reminder }] }`, sorted by time — on a changed day
  the row has that day's title and time; `reminder` is always the series. A day's count shows in amber under its dot (`99+` past 99; the
  count line only in a month that has some, so plain months keep their height), and the card lists
  "Your reminders" with the total, the first 3 by time and "+N more · Show all", which opens
  `RemindersSheet`: all of them grouped by hour, each hour's header pinned, in a virtualized list
  scrolling inside the sheet (only its grab bar drags it). Each row shows the title, how it repeats
  ("Monthly · the 8th (Hebrew)") and its time; a once-reminder whose time (the row's) has passed
  in Israel time (`isDone`, `Asia/Jerusalem`) is dimmed "Done · …". The tab's `now` ticks once a minute, so
  a reminder dims while the tab is open and "today" moves on after midnight. A floating + (`FloatingButton`, base/buttons) adds a reminder on the selected day. Tapping a row
  (card or sheet) opens the same `CustomReminderSheet` (composite, a `BottomSheet`) as "Edit
  reminder" with Delete, filled with that day's values on a changed day. The sheet: a title (`titleProblem`, 60
  max; curly quotes straightened as typed, `straightenQuotes`), the start date with ‹ › and its Hebrew date, hour and 5-minute steppers, Once / Daily /
  Monthly / Yearly, Gregorian or Hebrew for monthly and yearly (each choice showing the day it
  means), notes for dates some months or years lack (`oddDateNotes`), and a summary with the next
  3 dates (`nextDates` in `occurrences.js`, recomputed as the timing changes). Changing or
  deleting a repeating reminder asks "Only <day>" — delete → `skipCustomReminderDay` for the
  tapped day (dropping its `changed` entry); edit → `editCustomReminderDay`: sets
  `changed[day]` to the new title and time, in place (again for the same day overwrites it; the
  series' own values remove the entry) — or "Every time" (`updateCustomReminder` /
  `deleteCustomReminder` on the series; an update drops the tapped day's `changed` entry — the
  form started from its values — and those on days the new rule no longer falls on). An edit that changed the date, repeat or calendar offers
  only "Every time", since those are the series'. Deleting a once-reminder asks Keep / Delete.
  Each thunk saves with one plain action (ids from RTK's `nanoid`, titles trimmed, `calendar`
  `gregorian` unless given, `skipped` sorted without duplicates); the only checks are the title
  (`titleProblem`) and at most 300 reminders — the sheet's controls can't produce anything else —
  and a failed one rejects with the message the sheet shows (`error`). An id that's gone does
  nothing. Saving selects the reminder's start day when
  it's in the month shown. `customRemindersSlice` persists only `items` and isn't reset on sign-out
  or account deletion. Each change reschedules the
  notifications (see Reminder notifications below).
- `(tabs)/account` — a heading and six cards (`src/features/account/components/`, `ThemeCard` in
  `src/shared/components/composite/`): `ThemeCard` (light/
  dark toggle), `NotificationsCard` (see Notifications below), `AccountCard` (email; edit email/password via `POST /auth/account` — the
  `updateAccount` thunk, see `apps/users` above), `ProfileCard` (name and phone; fetches
  `GET /users/me` on mount, saves via `PATCH /users/me`, an emptied field sent as `null`),
  `LogoutCard` (confirmed in place; `authSlice`'s `logOut`, which also revokes the refresh token
  with a best-effort `POST /auth/logout` — offline, the device still signs out), `DeleteAccountCard` (asks for the password, then
  `DELETE /auth/account` via `authSlice`'s `deleteAccount`, which signs out on success). Each card
  holds its row and its edit/confirm form as a private component in the same file, so Cancel drops
  whatever was typed. The cards render only while signed in, so signing out unmounts them — every
  form starts closed for the next session. Account is the one tab opted into
  `requiresAuth: true` (`(tabs)/_layout.js`'s `TABS`). A press on a `requiresAuth` tab in
  `CustomTabBar`, or a swipe onto it (it springs back), while signed out shows `ConfirmModal`
  ("Log in to view Account?") instead of navigating; a direct hit on the route (deep link, web refresh, reopening the app on this tab)
  bypasses that entirely, so `AccountScreen` also calls `useRequireAuth()` on mount and renders
  `RequireAuthNotice` in that case — both are generic (`src/features/account/hooks/`, `src/features/account/components/`),
  reusable by any future `requiresAuth` tab, not Account-specific. Below the cards, `VersionInfo`
  (`base/feedback/`): "Personal Copilot <frontend version>" and "built <date>" from
  `src/shared/config/version.js` — "dev", and no date, when not built by the Dockerfile or `apk.js build`
  (see [Versions](#versions)).
- `(tabs)/admin` — admins only: `requiresRole: 'admin'` in `TABS` leaves the tab out of the bar and
  the swipe order for everyone else, and the screen checks again (`useRequireAuth`, `useHasRole('admin')`) for a direct
  link, showing `RequireAuthNotice` otherwise; the server checks the role too (`AdminGuard`).
  `SystemStatus` lists `GET /admin/status` (`adminSlice.fetchSystemStatus`, not persisted, reset on
  sign-out): each service up/down with its version, build time and uptime. Refreshed on every
  visit, by its button and by pull; then `VersionInfo`.
- **Location sync** — `app/_layout.js`'s `LocationSyncManager` dispatches `profileSlice`'s
  `syncLocation` whenever the user is signed in and `locationSlice.status` is `'ready'` (a fresh
  GPS fix this session — the persisted last-known `coords` alone never trigger it).
  `syncLocation` compares the fix with the location the server already has (`GET /users/me`'s
  `location`, fetched first if the profile isn't loaded) and sends `PUT /users/me/location` only if
  the device moved more than `LOCATION_SYNC_MIN_KM` (5, haversine in `src/shared/utils/geo.js`). The server's copy is the reference — there's no local "last sent" record to go
  stale across accounts or devices. One sync runs at a time; a reply that lands after sign-out
  (or a different sign-in) is dropped; a failure is simply retried on the next fix.
- **Notifications** — `notificationsSlice` is this phone's permission to show the reminders it
  schedules itself (see Reminder notifications below): Android's notification permission, with no
  account involved and nothing registered with a server. State `{ permission, ready, busy,
  promptDismissed }` — `permission` is `'unsupported'` (the web build, or the channel failed),
  `'default'`, `'granted'` or `'denied'` (only once Android won't ask again: Android 13+ asks twice
  at most; below 13 notifications are allowed unless turned off in settings); `ready` once
  `initNotifications` has run; `busy` while Android's prompt is open. Only `promptDismissed`
  persists — the permission is read from Android on every start. The I/O is
  `localNotificationsService` (`ensureChannel`, `getPermission`, `requestPermission`,
  `openSettings`).
  - `initNotifications` creates the "Reminders" channel and reads the permission.
    `ReminderScheduleManager` (`app/_layout.js`) dispatches it at start, and its
    `watchNotificationPermission` re-runs it on every return to the foreground
    (`appStateService.watchForeground`) — the permission is changed in Android's settings, outside
    the app. `NotificationsCard` also re-runs it on mount.
  - `enableNotifications` shows Android's "Allow notifications?" and stores the answer;
    `openNotificationSettings` opens the app's page in Android's settings. Turning notifications
    off is Android's setting, not the app's.
  - `NotificationsPrompt` (`features/reminders`, rendered once in `app/_layout.js`, so it opens
    over any tab, signed in or not): a one-time "Turn on notifications?" `ConfirmModal` ("Get your
    reminders on this phone, even when the app is closed."), shown only when needed — a reminder
    exists (the candle-lighting one is on, or the user has one of their own), `ready`, `permission`
    is `default`, and the prompt hasn't been answered on this device (`promptDismissed`). Turn on → `enableNotifications`; either answer sets `promptDismissed`
    (`dismissNotificationsPrompt`). Afterwards the candle reminder's nudge and the Account card
    still offer it.
  - `NotificationsCard` (Account): a switch showing the permission (on = `granted`). Switched on
    while `default`, it asks Android; any other change opens Android's settings. `denied` adds a
    warning `Alert` with Open settings; the switch is disabled while unsupported or busy.
  - Log Out and account deletion leave notifications alone: the reminders and their notifications
    belong to the phone, not the account.
  - **Server push (FCM, Android).** The app registers nothing with the Notification Service. A
    phone that holds an FCM device key (`fcmDeviceKey` in `expo-secure-store`,
    `src/shared/device/fcmService.android.js`) still receives what the server sends it.
    Receiving: `frontend/index.js` (the entry) loads `src/shared/device/fcmReceiver.android.js`
    before the app, since a message can start the JS headless with the app swiped away. Its
    `expo-task-manager` task finds `{ v: '1', enc }`, decrypts it with the key (AES-256-GCM,
    `@noble/ciphers`), skips it past `expiresAt`, and shows it in the "Reminders" channel with
    `identifier` = `notificationId` (a retry duplicate replaces the first) and `data.url`; a tap
    opens that page (`ReminderScheduleManager`, as for local reminders). No key → nothing shown.
  - **Web.** The web build has no service worker and no push: it neither subscribes to Web Push
    nor schedules notifications. The Notification Service still delivers to browser subscriptions
    it stores (`WebPushChannel`, see [Notifications](#notifications)).
- **Staying signed in** — the 15-min access token is renewed with the 30-day refresh token
  (`authSlice.refreshSession` → `authService.refresh`, `POST /auth/refresh`; each use rotates the
  pair), so an app opened at least once in 30 days stays signed in. One renewal at a time:
  concurrent callers share the one in flight (a rotated refresh token can't be used twice), and at
  most one starts per 30 s (`RENEW_RETRY_MS` — the route is rate-limited). It runs from `AuthGate`
  a minute before expiry (`RENEW_BEFORE_EXPIRY_MS`; at once if already expired, e.g. on start)
  and on `AppState` `active` when due (`renewSessionIfDue` — phone timers don't run in the
  background); one the server didn't answer is retried 30 s later. `authorizedFetch` (every
  signed-in HTTP call) also renews before sending when its token has already expired — the calls
  screens make at start would otherwise go out ahead of `AuthGate`'s renewal. And on a `401`:
  it passes the rejected token to the handler set with
  `setUnauthorizedHandler` (`src/store/index.js`) — the current token → `refreshSession`; an
  older one → the current token if it's still the same user's — and retries that call once with
  the token it resolves with, never more. Signed-in effects that load the user's data
  (`LocationSyncManager`, `syncLocation`'s same-user
  check) key on `selectUserId`, not the token, so a renewal doesn't re-run them.
- **Session ended** — only a refresh the server refuses (`400`/`401`: revoked by Log Out, account
  deletion or a password change elsewhere, or 30 days unused) signs out:
  `clearAuth({ notice: SESSION_ENDED_NOTICE })`. Offline, a `5xx` or `429` keeps the session.
  `AuthGate` pushes to `/login` once when a notice appears — not on later navigation, so leaving
  login sticks — and the login screen shows it as a warning `Alert`. The notice (not persisted) is
  cleared by Register, "Continue without logging in", unmounting login, and a successful
  login/register. Log Out signs out with no notice (it waits for a renewal in flight, then revokes
  the current refresh token). Other errors (e.g. `500`) keep the session. Two browser tabs share
  the saved tokens but renew separately, so one may find its refresh token already rotated by the
  other and sign out.
- `profileSlice` (`{ profile, status, error, locationSyncing }`) isn't persisted; it's fetched when
  `ProfileCard` mounts or a sync needs it, and reset on `clearAuth` and a successful
  `deleteAccount` so one user's profile is never shown to the next.
- `remindersSlice` (`{ candles, candleFirings }` — `candles` is `{ enabled, offsetMinutes }`,
  starting `{ enabled: false, offsetMinutes: 90 }`, never `null`; `candleFirings` see "Reminder
  notifications" below) persists both and isn't
  reset on sign-out or account deletion. Turning off keeps the offset, so the sheet reopens on it.
- **Reminder notifications** (Android APK only — `localNotificationsService.js`, the web build's
  stand-in, does nothing). Both kinds of reminder fire as exact local alarms the phone schedules
  itself (`src/shared/device/localNotificationsService.android.js` over expo-notifications: a date
  trigger in the "Reminders" channel, which it also creates — `ensureChannel`, also called by
  `fcmService.init`). `reminders/utils/schedulePlan.js` is the pure planner: each reminder's
  firings from now to 30 days ahead (`WINDOW_DAYS`) plus its very next one even when further, at
  most 100 in all (`MAX_TOTAL` — every reminder's next firing first, then the earliest of the rest).
  Each reminder's firings come from a generator, worked out only as far as they're kept (a merge
  of the reminders' streams), so a few hundred reminders plan in well under a second on the phone.
  - Candle lighting: each successive `ShabbatCalendar.nextCandleLighting` for `location.coords`,
    fired at candle lighting − offset (whole minutes) — "Shabbat candle lighting" / "Candle lighting
    is at 17:34 (in 1 h 30 min).", opening `/`. No location, or one with no sunset (polar) → none.
    Once a week: after each reconcile, the shabbat slice keeps the planned firing time per candle
    lighting date (`reminders.candleFirings`, persisted, set with `candleFiringsPlanned`); a date
    whose time has passed — gone off, or dropped with the phone off — is left out of the plan
    until it's over, so a move or a new offset after it can't fire that week again.
  - Custom: its days walked from Israel's midnight today, each at that day's `changed` time and
    title if any, else the series' — its title / "Your reminder for 08:00.", opening `/calendar`.
  - Ids are deterministic: `rem:candles:<candle lighting ms>`, `rem:c:<reminder id>:<YYYY-MM-DD>`;
    only `rem:` ids count as ours. Data `{ url, at }`; HH:MM from `israelClock`
    (`src/shared/utils/date.js`).
  - `reconcileReminderNotifications` (`reminders/store/scheduleNotifications.js`) cancels every one
    of ours not in the plan or different from it and schedules the missing ones. One run at a time
    (asked for during one, it runs once more after); it never rejects — a failure is logged and the
    next trigger retries. Triggers: every custom-reminder change thunk and both candle thunks (after
    their plain action, not awaited), and `ReminderScheduleManager` (`app/_layout.js`) on start —
    which also covers the first start after an update — on return to the foreground
    (`appStateService.watchForeground`) and when the location really moves (`placeOf` in
    `src/shared/utils/geo.js`: coordinates rounded to 2 decimals, ~1 km — GPS wobble doesn't count). A tap on any
    notification with `data.url` (local or FCM; also the one that opened the app) navigates there.
  - Daily background run, so the 30-day window keeps moving with the app unopened:
    `ReminderScheduleManager` registers the task `reminder-notifications`
    (`registerBackgroundReconcile`, ~every 24 h; a failure only warns), and Android's WorkManager
    runs it through expo-background-task (`src/shared/device/backgroundTaskService.android.js`;
    the web build's `.js` stand-in does nothing) — when it allows, only while online, never at an
    exact time, with the app closed or swiped away. The task (`defineBackgroundReconcile`) waits
    for redux-persist to rehydrate, then dispatches the same `reconcileReminderNotifications`. It's
    defined in `src/store/backgroundTasks.js`, imported by the entry (`frontend/index.js`) before
    the app, since Android starts the JS headless just for the task. A late or skipped run costs
    nothing: the exact alarms already scheduled cover 30 days.
  - expo-notifications re-arms pending alarms after a reboot or an APK update; one due while the
    phone was off is dropped, never shown late. `app.json`'s `USE_EXACT_ALARM` keeps them exact.
    Reminders still saved on the server fire there too, so the same one can arrive twice until
    it's removed from the server.
- **App update** (Android APK only — `appUpdateSlice` does nothing on the web, or when
  `URLS.apkRegistry`/`EXPO_PUBLIC_FRONTEND_VERSION` isn't baked in). `app/_layout.js`'s
  `AppUpdateManager` dispatches `deleteOldUpdates` and `checkForUpdate` at start, and
  `checkForUpdate` again whenever `AppState` returns to `active` and on Gateway's `app-update`
  over `/ws` (`listenForUpdates`, via `socketService.on`). The check fetches the registry's
  `latest.json` (`appUpdateService`, `cache: 'no-store'`; a relative `url` resolved against the
  registry folder) and compares its `versionCode` with the installed one —
  `src/shared/utils/versionCode.js` applied to the baked frontend version; a failed check is ignored. No
  login needed.
  - Newer → `latest` is set, `UpdateSheet` (composite, a `BottomSheet` mounted app-wide by
    `AppUpdateManager`, so it opens over any tab) opens by itself once per version: Later, Update
    and Install all set `dismissedVersionCode` (the slice's only persisted field). `UpdateChip`
    ("↑ <version>", top right of Home's clock card) stays while `latest` is set and reopens the sheet.
  - Update → `installUpdate`: unless the APK is already in the cache, downloads `latest.url` into
    `<cache>/updates/<versionCode>.part` (`expo-file-system`, progress throttled to one dispatch per
    percent), renames it to `.apk` when complete, then opens Android's installer
    (`expo-intent-launcher`, `ACTION_VIEW` on the file's `content://` URI with read permission;
    `REQUEST_INSTALL_PACKAGES` in `app.json`). `download.status`: `idle` → `downloading` (progress
    bar + Cancel, which returns to `idle` and closes the sheet) → `ready` (the file is cached; the
    sheet says to turn on "Allow from this source" if Android asks, and Install reopens the installer) or
    `failed` (Try again). Closing the sheet mid-download doesn't stop it. A successful install
    restarts the app.
  - `deleteOldUpdates` (start) deletes every `.part` and every APK at or below the installed
    `versionCode`. Update files never go to Downloads.

Talks only to Gateway for every API call (`EXPO_PUBLIC_GATEWAY_ORIGIN`, baked in at build time,
required — `src/shared/config/urls.js` throws at load if it's unset) — never the Users Service or any
other backend service directly. The one other origin it reads is the APK registry
(`URLS.apkRegistry`, `EXPO_PUBLIC_APK_REGISTRY_URL`): static, read-only files (`latest.json` and
the APK) served by the frontend's own Caddy at `/apk/` — not a backend service and no API, see
`frontend/README.md`'s `/apk/` paragraph.

The web build is installable (Android Chrome's Install): `frontend/public/manifest.webmanifest`
plus `frontend/public/index.html` (Expo's single-page template with the manifest link and
`theme-color`), the manifest served as `application/manifest+json` by `frontend/Caddyfile` — see
`frontend/README.md`'s "Installable web app".

Themed via `themeSlice` → `useAppTheme()` and the shared components under `src/shared/components/`
(`base/` primitives, `composite/` built from them) — the list is in `frontend/README.md`, the
conventions in `.claude/agents/frontend.md`. The code is in feature folders (`src/features/<name>/`:
`shabbat`, `calendar`, `reminders`, `app-update`, `account`), cross-feature code in `src/shared/`,
the calendar maths in `src/lib/jewish-calendar/` — layout and import rules in `frontend/README.md`'s
"Feature folders".

I/O lives in each feature's `services/` and in `src/shared/`. HTTP (fetch-based calls — `authService`,
`usersService` for `/users/me*`, `adminService` for `/admin/status`,
`realtimeService` for the device token, `appUpdateService` for the APK registry's `latest.json`;
signed-in calls go through `httpClient`'s `authorizedFetch` (`shared/http/`)), `shared/realtime/`
(`socketService`, a single shared Socket.IO connection), and on-device I/O (`shared/device/`: `locationService` —
`expo-location` permission + position; `fcmService` /
`fcmReceiver` — incoming FCM messages on Android; `localNotificationsService` — the phone's own scheduled reminder notifications, the "Reminders" channel and the notification permission; `appStateService` — foreground changes; `backgroundTaskService` — periodic background tasks (WorkManager); app-update's `apkInstallerService` —
the update APK's download into the app cache, Android's installer, and cleanup). calendar's
`calendarService` does no I/O but keeps the same boundary: Shabbat times and months computed on
the phone from `src/lib/jewish-calendar/`, returned as plain JSON (times as ISO strings, the shape
Gateway's `/calendar/*` answered) so Redux state stays serializable.

The Socket.IO connection is open signed in or not, always with this install's device token:
`wsSlice` fetches it once (`realtimeService.requestDeviceToken`, `POST /realtime/device`) and
persists it; if Gateway refuses it (`device_token_invalid`, e.g. after a `JWT_SECRET` change), it
fetches a new one and reconnects. Without a login token the connection is anonymous and gets
Gateway's broadcasts only. `app/_layout.js`'s `RealtimeConnectionManager` dispatches `wsSlice`'s
`connectWebSocket` whenever `authSlice.accessToken` changes and the app isn't in the background:
signing in or out changes identity, so it reconnects; a new token for the same session (refresh,
`updateAccount`) keeps the connection and only replaces the token its next reconnect sends — or
reopens it at once if Gateway refused it (`token_invalid`, e.g. the expired token it replaces). It
calls `disconnectWebSocket` when `AppState` goes to `background` and `connectWebSocket` again on
`active`. Features subscribe with `socketService.on(event, handler)` (returns the unsubscribe),
which re-attaches the handler to every new connection — never a second connection.
`appUpdateSlice.listenForUpdates` (`app-update`) is the one listener today. A device has one
connection, so in the browser only one tab holds it: another tab connecting closes it, and it opens
a new one when it's shown again.

`authSlice` stores the `refreshToken` that register/login return; it renews the session (see
"Staying signed in" above) and is revoked by `logOut`.

## Versions

`version/versions.json` (repo root) holds one version per deployable component (`frontend`,
`gateway`, `users`, `reminders`, `notifications`), each its own. Bumped only by
`node scripts/version.js` (bump rules: `CLAUDE.md`'s "Versions" section; tests:
`node --test scripts/version.test.js`):

- `node scripts/version.js` — prints the file.
- `node scripts/version.js <component> major|minor|patch [--test]` — bumps the component; `--test`
  gives the next `-test.N` of that bump (`1.2.0` → `1.3.0-test.1` → `1.3.0-test.2`).
- `node scripts/version.js <component> release` — drops `-test.N`.

Minor and patch must stay ≤ 99 and `N` ≤ 98 (room for an Android `versionCode`). Never runs git;
prints the `git tag <component>-v<version>` to add after committing.

Images get the folder as a separate build context named `version` (see `architecture.md`'s
"Compose / build layout"). Each backend image copies only its own entry to
`/app/version/versions.json`, plus its build time in `/app/version/built-at`. Users, Reminders and
Notifications answer `GET /health` (compose healthcheck; internal-only) with:

```json
{ "status": "ok", "service": "reminders", "version": "0.1.0",
  "builtAt": "2026-10-05T18:00:00Z", "startedAt": "2026-10-05T18:02:11.123Z" }
```

([`@app/build-info`](#libsbuild-info).) The frontend image bakes in its version and build time
(`EXPO_PUBLIC_FRONTEND_VERSION`/`EXPO_PUBLIC_BUILT_AT`), shown by the
Account tab's `VersionInfo` (and at the bottom of the Admin tab, which lists every backend
service's version from `GET /admin/status`).

## libs/auth-kernel

Shared JWT sign/verify (`IJwtService`/`JsonWebTokenService`, the only class allowed to import
`jsonwebtoken`), the higher-level `IAuthTokenService`/`AuthTokenService` used by every guard,
`DeviceTokenService` (Gateway's device tokens), `JwtAuthGuard` (any role in `USER_ROLES`) and
`AdminGuard` (`JwtAuthGuard` + admins only → `403`). Used by `apps/users` (signs, on
login/register/refresh/account) and `apps/gateway` (verifies — `JwtAuthGuard` on every
`auth: 'user'` row of `PROXY_ROUTES`, `AdminGuard` on `GET /admin/status`, and the `/ws`
handshake). Also `USER_ID_HEADER` + `@ForwardedUserId()`, the internal-service side of Gateway's
forwarded user id (see Gateway above) — used by `apps/users`, `apps/reminders` and
`apps/notifications`.
## libs/build-info

`buildInfo(service)` → `{ service, version, builtAt, startedAt }`. Reads `versions.json` and
`built-at` from the first of `./version`, `../version` that has a `versions.json` —
so a local `nest start` from `backend/` reads the repo's own file, with `builtAt` `null` (nothing
writes `built-at` outside Docker). Missing entry or file → `null`. `startedAt` is fixed at module
load.

## libs/jewish-calendar

All of the project's Jewish-calendar maths, in one place.
`@hebcal/core` v6, imported only under `hebcal/` (`HebcalCalendarCalculator` behind
`ICalendarCalculator`, and `hebrew-dates.ts`); `ShabbatCalendar` (`IShabbatCalendar`),
`MonthCalendar` (`IMonthCalendar`) and `ReminderOccurrences` (`IReminderOccurrences`) are the
entry points, pure and synchronous. Used in-process by Gateway (`GET /calendar/shabbat`,
`GET /calendar/month` — not called by the app) and the Reminders scheduler. The app computes
Home's times and the Calendar tab's months from its own copy, `frontend/src/lib/jewish-calendar/`
(the same source) — so Home, the calendar and reminders always agree, and a rule changes in one place (`calendar-options.ts` picks the candle-lighting
minutes for all of them).

- `current(location, now)` — the Shabbat in progress at `now`, otherwise the next one: candle
  lighting, Havdalah, parasha, holidays, `isNow`. The Shabbat that started last Friday is returned
  while it's still running — including through a Yom Tov directly after it (`havdalah` can be
  Sunday night when a Yom Tov falls on Sunday). `parasha` is `null` when a holiday replaces the weekly reading;
  `holidays` lists what falls on that Saturday, minus eves, modern civic days and Leil Selichot.
  Names come in English and unvoweled Hebrew, tidied where hebcal's read badly
  (`holiday-names.ts`: "Rosh Hashana I" without the year, "Sukkot · day 3 (Chol HaMoed)" for
  Sukkot/Pesach II–VI (CH''M), "Hoshana Raba" for Sukkot VII).
- `nextCandleLighting(location, after)` — the first Friday candle lighting strictly after `after`.
  Weeks with no sunset are skipped; throws `UnprocessableEntityException` (`422`) only after 26
  such weeks in a row (or from `current` when this week has none).
- `MonthCalendar.month(location, year, month)` — every day of a civil month: its Hebrew date
  (numbers, plus the day and year in Hebrew letters), its holidays/fasts — `yomTov` when work is
  forbidden (Yom Kippur too), `fast` for other fasts, `holiday` for the rest (Chol HaMoed, Rosh
  Chodesh, eves, special Shabbatot, modern days) — Saturday's parasha, and its times: candle
  lighting on the day it's lit (Friday, an eve, or a second Yom Tov night after nightfall), Havdalah,
  and a fast's start and end — Yom Kippur as a fast too: `fastBegins` at its eve's candle
  lighting, `fastEnds` instead of Havdalah. Chanukah's candles aren't included.
- `ReminderOccurrences` — when a user's own reminder falls, from its `ReminderRule`: `start` (a
  civil date; a once-reminder's only day), `hour`/`minute` (wall clock), `repeat` (`once` / `daily`
  / `monthly` / `yearly`), `calendar` (`gregorian` / `hebrew`, for monthly and yearly) and
  `skipped` days. `fallsOn(rule, date)`, `datesBetween(rule, from, to)` (both days included) and
  `nextAfter(rule, after, timeZone)` — the first time it fires strictly after `after`, `null` if
  never. A date a month or year doesn't have (a Hebrew 30th in a 29-day month, the 31st, 29 Feb)
  falls on that month's last day; a Hebrew yearly one in Adar made in a regular year is in Adar II
  in a leap year, and one in Adar I or II of a leap year is in Adar in a regular year. A wall time
  the clocks skip lands that much later; one they repeat is the second. `ISRAEL_TIME_ZONE`
  (`'Asia/Jerusalem'`) is exported for callers that fix the zone to Israel's.
- Rules, for all: the app is Israel-only. A `GeoLocation` is just `{ latitude, longitude }`;
  every calculation uses Israel's calendar (one-day Yom Tov) and Israel's time zone
  (`ISRAEL_TIME_ZONE`) wherever the point is — "today" is the date in Israel, never the server's,
  and a point abroad gets Israel's rules with that spot's sunset. Candle lighting is 20 min before
  sunset — 40 in Jerusalem and Petach Tikva, 30 in Haifa, Tzfat and Zikhron Ya'akov (OU Israel /
  MyZmanim), matched by distance from the city center (`israel-city-customs.ts`; the radius is
  approximate, so a town right next to a city can count as it). Havdalah is Hebcal's default (sun 8.5° below the horizon).

See `backend/libs/jewish-calendar/README.md` for the non-obvious implementation details (ESM-only
import, server time zone, finding Havdalah, reminders' repeat rules).

## libs/kafka-contracts / libs/kafka-client

Kafka is for events (a fact any number of services may react to); BullMQ (below) is for jobs. The
Users Service publishes (through the outbox); Reminders consumes `users.user-state`.

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

## libs/queue-contracts / libs/queue-client

`queue-client`: `IQueuePublisher`/`BullmqQueuePublisher` (`publish(queue, data, { dedupeId,
dedupeTtlMs, delayMs, attempts, backoffMs })`, `remove(queue, jobId)`, `delayed(queue)` — every
delayed job's id and data, JSON job data, one BullMQ `Queue` per name) and
`IQueueConsumer`/`BullmqQueueConsumer` (`process(queue, guard, handler, { concurrency })`, the
handler getting the data plus `JobMeta` — ids, attempt number, and the job's `progress` with
`saveProgress(patch)`, which is kept across retries; workers
start on `onApplicationBootstrap` and close on `onModuleDestroy`, finishing in-flight jobs, before
the publisher's queues close on `onApplicationShutdown`; a job failing the guard fails with `UnrecoverableError`, never
retried; a handler that throws is retried while the job has attempts left). Both connect via
`REDIS_URL`; the only files that import `bullmq`.
`queue-contracts`: this project's cross-service queue names and job types with their guards —
`notification-requested` (Reminders → Notification Service) and `reminder-due` (Reminders' own
delayed jobs, candle-lighting or custom by `kind`).
Also `notificationRequestedPublishOptions(message)`, the dedupe/retry options every publisher of
that queue must pass. See `event-schemas.md`.

## libs/users-schema

The Users Service's tables as other services may see them: read-only TypeORM entities
(`synchronize: false`, so a service that lists them never creates or alters them) —
`UsersUserEntity` (`users.users`, id only; the target of other services' `ON DELETE CASCADE`
foreign keys) and `UsersProfileEntity` (`users.profiles`, location columns; read by Reminders). Only
the Users Service writes these tables; its own full entities stay in `apps/users`.
