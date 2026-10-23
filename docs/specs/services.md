# Services

Two NestJS apps in `backend/apps/` (`gateway`, `users`), shared libs in `backend/libs/`, the
Android app (`frontend/`, with its calendar maths in `frontend/src/lib/jewish-calendar/`) and
`apk`, the static APK registry. Both backend services are dormant — `profiles: ["backend"]` in
compose, called only by the app's hidden login/account screens (see [frontend](#frontend)). See
`architecture.md` for the topology diagram.

## gateway

The only backend service reachable from outside the Docker network, through `tailscale serve`
(`architecture.md`'s "System topology"). HTTP only.

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/account`,
  `DELETE /auth/account` → the Users Service route of the same name, body untouched. No guard on any of them (for
  the first four, that's how you get a token in the first place; `account` is body-driven the same
  way — see [users](#users)).
- `GET /users/me`, `PATCH /users/me`, `PUT /users/me/location` (`JwtAuthGuard`) → Users Service's
  routes of the same name. Body relayed untouched.
- Every forwarded route above (`/auth/*`, `/users/me*`) is one row of `PROXY_ROUTES` (`src/proxy/proxy.routes.ts`): method, path (the same on Gateway and the
  service; a `:param` is filled in from the request, URL-encoded so it stays one path segment, and
  a `GET`'s query string is passed on as sent — `api/forwarded-path.ts`), target service, `auth: 'user'` (`JwtAuthGuard` + `X-User-Id`) or `'none'`, and
  `throttle: 'strict'` where it applies. `ProxyController` turns each row into its own Nest route,
  so anything unlisted is a `404` — never a wildcard. `ProxyService` sends it through that service's
  `ServiceHttpClient` (base URL from `USERS_SERVICE_URL`); an unreachable service answers
  `502 { error: { code: 'users_service_unreachable', message } }`. Adding a route is one row there,
  plus the same row in `test/proxy.api.spec.ts`'s `CONTRACT`.
- **User identity for internal services:** a guarded route forwards only the token's user id, in
  an `X-User-Id` header Gateway sets itself (`USER_ID_HEADER` in `@app/auth-kernel`). Client
  headers are never passed through, so a client can't supply its own. The internal service reads
  it with `@ForwardedUserId()` (401 if absent) and trusts it because only Gateway can reach it.
- `GET /admin/status` (`AdminGuard`, `src/admin/`) — **answered by Gateway itself**: its own
  [`buildInfo`](#libsbuild-info) read in-process, plus the Users Service's `/health` (the same
  `USERS_SERVICE_URL` the proxy uses), asked with a timeout (`ADMIN_STATUS_TIMEOUT_MS`, default 2000). No answer, a non-200 or a body without
  `status: 'ok'` → `down`, never an error. `Cache-Control: no-store`. Gateway first:
  ```json
  [{ "service": "gateway", "status": "up", "version": "0.1.0", "builtAt": "…", "startedAt": "…", "latencyMs": null },
   { "service": "users", "status": "down", "version": null, "builtAt": null, "startedAt": null, "latencyMs": null }]
  ```
- Rate limiting (`@nestjs/throttler`): a global limit (`THROTTLE_TTL_MS`/`THROTTLE_LIMIT`, default
  60 s/100) on every route, plus a strict one (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`,
  default 60 s/5) on `register`/`login`/`refresh`/`account` (both methods). `logout`
  and `/users/me*` stay on the global one. Why two tiers: `backend/apps/gateway/README.md`. Keyed on client IP: `main.ts` sets
  `trust proxy` to `src/trust-proxy.ts`'s `TRUST_PROXY` (loopback + private networks — safe
  because the port is published on `127.0.0.1` only), so that IP is the one `tailscale serve`
  forwarded — see `architecture.md`.
- CORS is permissive (`origin: true`, reflects any origin) — why
  that's safe: `backend/apps/gateway/README.md`.
- No `/health`, and versions only behind `AdminGuard` (`GET /admin/status`) — Gateway is the
  public entry. Its image bakes in its version like the others (see
  [Versions](#versions)).

## users

HTTP, internal-only (only Gateway calls it), schema `users` in the shared database. Owns both how
you log in (`users`, `refresh_tokens`) and who you are (`profiles`).

- `POST /auth/register` — `{ email, password, firstName?, lastName?, phone? }` →
  `{ access_token, refresh_token }`. The optional details go into the profile, created in the same
  transaction as the account.
- `POST /auth/login` — same shape.
- `POST /auth/refresh` — `{ refresh_token }` → new `{ access_token, refresh_token }` (rotates; the
  old refresh token is revoked regardless of outcome, and of two refreshes with it at once only the
  one that revoked it gets a pair — the other `401`).
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
  deletes the user, profile and refresh tokens in one transaction. Immediate, no undo. An
  access token issued before keeps passing `JwtAuthGuard` until it expires (≤ 15 min), but every
  `/users/me` call with it answers `404`.
- `GET /users/me` → `{ firstName, lastName, phone, location: { lat, lon, updatedAt } | null }`
  (user from `X-User-Id`); `404` for a user that no longer exists.
- `PATCH /users/me` — any of `{ firstName, lastName, phone }`; only the fields sent change, `null`
  clears one, none at all → `400`. Names are trimmed, 1–100 chars, English or Hebrew letters only with single spaces between words
  (`NAME_PATTERN` in `models/profile.ts`, also applied by register); `phone` in international format
  (`+972501234567`). Returns the profile.
- `PUT /users/me/location` — `{ lat, lon }` → the profile; `updatedAt` is set here. No client
  calls it.
- `GET /health` — see [Versions](#versions).

**Profiles.** `profiles` table, keyed by `user_id` (the user's id and a foreign key, deleted with
the user): `first_name`, `last_name`, `phone`, `lat`, `lon`, `location_updated_at`. Every write locks the
row. Every account has one
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

Postgres via TypeORM (`users`, `refresh_tokens`, `profiles`). A change an existing database must
get (a dropped table, column or schema) is a migration in `src/infrastructure/postgres/migrations/`,
run on every boot and recorded in `users.migrations` — today they drop `outbox_events`,
`profiles.version` and the `reminders` and `notifications` schemas; why they're shaped as they are:
`backend/apps/users/README.md`. password_hash = SHA256(`PASSWORD_PEPPER` + salt +
plaintext). Access tokens: 15-min TTL, `{ sub, role, email }` payload; refresh tokens: 30 days,
rotated on every use. `UserRole` is
`'user' | 'admin'` (`USER_ROLES` in `@app/auth-kernel`); `register` always creates `'user'`. The
only `'admin'` is the one `AdminSeedService` creates once at boot from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
(see `docs/users/environment.md`). `JsonWebTokenService.verify` accepts any role in `USER_ROLES`
(anything else → unauthenticated), so the admin signs in and uses every `JwtAuthGuard` route like
any user. `AdminGuard` (same lib) is `JwtAuthGuard` plus `role === 'admin'`: no or
a bad token → `401`, a non-admin → `403 Admins only`. Used by Gateway's `GET /admin/status`.

An email is unique by the `users.email` constraint alone: `register` and `account` write and turn a
duplicate-key error into `409`, with no lookup first, so two requests for one email at the same
moment can't both pass a check.

Refresh tokens are stored as a plain SHA-256 hash (no salt/pepper) — sufficient since a refresh
token is already a high-entropy random value, not human-guessable like a password, so this only
guards against a raw DB leak, not brute force. `refresh` always revokes the used token first, then
issues a new pair, so a stolen-and-replayed refresh token only ever works once.

## frontend

Expo Router app, built only as an Android APK (`node devops/android/apk.js build`). Login is optional app-wide, not a gate on the whole app: `(tabs)` routes are
reachable while signed out, and `(auth)/login`/`(auth)/register` each add a "Continue without
logging in" link (routes to `/`) for whoever lands there without wanting to authenticate.

The root layout (`app/_layout.js`), inside the Redux `Provider` and `PersistGate`, renders
`ThemedStatusBar`, the router's `Stack`, then the app-wide managers `ReminderScheduleManager`,
`NotificationsPrompt` and `AppUpdateManager` (each described below). The account feature's
`AuthGate` is dormant — kept, not mounted — so the app renews no session on its own. The entry
(`frontend/index.js`) loads `src/shared/device/notificationDisplay.js` (the foreground
notification handler: a reminder due with the app open shows as a banner too) and
`src/store/backgroundTasks.js` before the app, since Android can start the JS with no app at all.

The tabs are a swipeable row (`SwipeTabs` over `TabPager`, `(tabs)/_layout.js`): drag sideways
anywhere on a screen to the next or previous tab in the bar's order — the screen follows the finger,
past a quarter of the width or a flick slides on in 250 ms, otherwise it springs back, and past the
first or last tab it only stretches a little. A tap on the bar runs the same slide (a jump of more
than one tab starts from the tab next to the target). A drag starting within 20 dp of either side is
left to Android's back gesture; on the Calendar, a drag on the month grid moves months instead
(`SwipePager` blocks the tab pan). A tab mounts when it's shown or next to the one shown, then stays
mounted. The bar and the swipe order are Home and Calendar: Account and Admin are `hidden: true` in
`TABS`, left out for everyone, and their routes open only from a direct link (`/account`,
`/admin`), drawn over the row with the swipe off. The theme has no switch in the bar's tabs: it
stays the saved `themeSlice.mode` (system by default).

- `(tabs)/index` (Home — the landing tab, no session required: live clock, today's Gregorian date,
  and today's Hebrew/Jewish date via `@hebcal/hdate`, chosen over `Intl`'s `'he-u-ca-hebrew'`
  calendar extension because Hermes's bundled ICU data isn't guaranteed to include non-Gregorian
  calendar tables on-device — see `frontend/README.md`). Under the clock, `ShabbatSection` shows the current/next Shabbat for
  the device's location: a label (holiday or parasha, or "Shabbat Shalom" while it's in progress),
  candle lighting and Havdalah with their dates, and a countdown to whichever comes next. "In
  progress" and the countdown are computed from the device clock against the two returned times
  (`calendarService.getShabbat`, computed on the phone from `src/lib/jewish-calendar` — no network,
  so it works offline; times as ISO strings — see [Calendar maths](#calendar-maths)).
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
    ask, Open settings (`openNotificationSettings`) once it's `denied`, nothing when unsupported.
    Save (`saveCandleReminder`) and Turn off (`turnOffCandleReminder`, shown only
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
  computed on the phone like Home's times; not persisted). Opens on the device's current month. A sideways drag moves the month with the
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
- `(tabs)/account` — hidden (direct link only, see above). A heading and six cards (`src/features/account/components/`, `ThemeCard` in
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
  `requiresAuth: true` (`(tabs)/_layout.js`'s `TABS`); hidden, it's never pressed or swiped to,
  but the guard stays for any `requiresAuth` tab in the bar. A press on a `requiresAuth` tab in
  `CustomTabBar`, or a swipe onto it (it springs back), while signed out shows `ConfirmModal`
  ("Log in to view Account?") instead of navigating; a direct hit on the route (deep link, reopening the app on this tab)
  bypasses that entirely, so `AccountScreen` also calls `useRequireAuth()` on mount and renders
  `RequireAuthNotice` in that case — both are generic (`src/features/account/hooks/`, `src/features/account/components/`),
  reusable by any future `requiresAuth` tab, not Account-specific. Below the cards, `VersionInfo`
  (`base/feedback/`): "Personal Copilot <frontend version>" and "built <date>" from
  `src/shared/config/version.js` — "dev", and no date, when not built by `apk.js build`
  (see [Versions](#versions)).
- `(tabs)/admin` — hidden (direct link only, see above); admins only: `requiresRole: 'admin'` in
  `TABS` would leave it out of the bar and the swipe order for everyone else, and the screen checks again (`useRequireAuth`, `useHasRole('admin')`) for a direct
  link, showing `RequireAuthNotice` otherwise; the server checks the role too (`AdminGuard`).
  `SystemStatus` lists `GET /admin/status` (`adminSlice.fetchSystemStatus`, not persisted, reset on
  sign-out): each service up/down with its version, build time and uptime. Refreshed on every
  visit, by its button and by pull; then `VersionInfo`.
- **Notifications** — `notificationsSlice` is this phone's permission to show the reminders it
  schedules itself (see Reminder notifications below): Android's notification permission, with no
  account involved and nothing registered with a server. State `{ permission, ready, busy,
  promptDismissed }` — `permission` is `'unsupported'` (the channel failed, or not Android),
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
- **Staying signed in** — the 15-min access token is renewed with the 30-day refresh token
  (`authSlice.refreshSession` → `authService.refresh`, `POST /auth/refresh`; each use rotates the
  pair), so an app opened at least once in 30 days stays signed in. One renewal at a time:
  concurrent callers share the one in flight (a rotated refresh token can't be used twice), and at
  most one starts per 30 s (`RENEW_RETRY_MS` — the route is rate-limited). `authorizedFetch`
  (every signed-in HTTP call) renews before sending when its token has already expired. The
  dormant `AuthGate` (exported by `account`, not mounted by `app/_layout.js`) would also renew a
  minute before expiry (`RENEW_BEFORE_EXPIRY_MS`) and on `AppState` `active` when due
  (`renewSessionIfDue`), retrying one the server didn't answer 30 s later. And on a `401`:
  it passes the rejected token to the handler set with
  `setUnauthorizedHandler` (`src/store/index.js`) — the current token → `refreshSession`; an
  older one → the current token if it's still the same user's — and retries that call once with
  the token it resolves with, never more.
- **Session ended** — only a refresh the server refuses (`400`/`401`: revoked by Log Out, account
  deletion or a password change elsewhere, or 30 days unused) signs out:
  `clearAuth({ notice: SESSION_ENDED_NOTICE })`. Offline, a `5xx` or `429` keeps the session.
  The login screen shows it as a warning `Alert` (the dormant `AuthGate` would push to `/login`
  once when a notice appears). The notice (not persisted) is
  cleared by Register, "Continue without logging in", unmounting login, and a successful
  login/register. Log Out signs out with no notice (it waits for a renewal in flight, then revokes
  the current refresh token). Other errors (e.g. `500`) keep the session.
- `profileSlice` (`{ profile, status, error }`) isn't persisted; it's fetched when
  `ProfileCard` mounts, and reset on `clearAuth` and a successful
  `deleteAccount` so one user's profile is never shown to the next.
- `remindersSlice` (`{ candles, candleFirings }` — `candles` is `{ enabled, offsetMinutes }`,
  starting `{ enabled: false, offsetMinutes: 90 }`, never `null`; `candleFirings` see "Reminder
  notifications" below) persists both and isn't
  reset on sign-out or account deletion. Turning off keeps the offset, so the sheet reopens on it.
- **Reminder notifications** (Android only — the plain `localNotificationsService.js`, which Jest's
  default platform resolves, does nothing). Both kinds of reminder fire as exact local alarms the phone schedules
  itself (`src/shared/device/localNotificationsService.android.js` over expo-notifications: a date
  trigger in the "Reminders" channel, which it also creates — `ensureChannel`). `reminders/utils/schedulePlan.js` is the pure planner: each reminder's
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
    notification with `data.url` (also the one that opened the app) navigates there.
  - Daily background run, so the 30-day window keeps moving with the app unopened:
    `ReminderScheduleManager` registers the task `reminder-notifications`
    (`registerBackgroundReconcile`, ~every 24 h; a failure only warns), and Android's WorkManager
    runs it through expo-background-task (`src/shared/device/backgroundTaskService.android.js`;
    the plain `.js`, Jest's, does nothing) — when it allows, only while online, never at an
    exact time, with the app closed or swiped away. The task (`defineBackgroundReconcile`) waits
    for redux-persist to rehydrate, then dispatches the same `reconcileReminderNotifications`. It's
    defined in `src/store/backgroundTasks.js`, imported by the entry (`frontend/index.js`) before
    the app, since Android starts the JS headless just for the task. A late or skipped run costs
    nothing: the exact alarms already scheduled cover 30 days.
  - expo-notifications re-arms pending alarms after a reboot or an APK update; one due while the
    phone was off is dropped, never shown late. `app.json`'s `USE_EXACT_ALARM` keeps them exact.
- **App update** (`appUpdateSlice` does nothing off Android, or when
  `URLS.apkRegistry`/`EXPO_PUBLIC_FRONTEND_VERSION` isn't baked in — a dev server). `app/_layout.js`'s
  `AppUpdateManager` dispatches `deleteOldUpdates` and `checkForUpdate` at start, and
  `checkForUpdate` again whenever `AppState` returns to `active`. The check fetches the registry's
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

Only the dormant login/register and account screens make API calls, and only to Gateway
(`URLS.gateway`, `EXPO_PUBLIC_GATEWAY_ORIGIN`, baked in at build time) — never the Users Service or
any other backend service directly. The variable is optional: without it `URLS.gateway` is `null`
and those calls fail; nothing else in the app needs it. The one other origin it reads is the APK registry
(`URLS.apkRegistry`, `EXPO_PUBLIC_APK_REGISTRY_URL`): static, read-only files (`latest.json` and
the APK) served by `apk`'s Caddy at `/apk/` — not a backend service and no API, see
[apk](#apk).

Themed via `themeSlice` → `useAppTheme()` and the shared components under `src/shared/components/`
(`base/` primitives, `composite/` built from them) — the list is in `frontend/README.md`, the
conventions in `.claude/agents/frontend.md`. The code is in feature folders (`src/features/<name>/`:
`shabbat`, `calendar`, `reminders`, `app-update`, `account`), cross-feature code in `src/shared/`,
the calendar maths in `src/lib/jewish-calendar/` — layout and import rules in `frontend/README.md`'s
"Feature folders".

I/O lives in each feature's `services/` and in `src/shared/`. HTTP (fetch-based calls — `authService`,
`usersService` for `/users/me`, `adminService` for `/admin/status`, `appUpdateService` for the APK
registry's `latest.json`; signed-in calls go through `httpClient`'s `authorizedFetch`
(`shared/http/`)) and on-device I/O (`shared/device/`: `locationService` — `expo-location`
permission + position; `localNotificationsService` — the phone's own scheduled reminder
notifications, the "Reminders" channel and the notification permission; `appStateService` —
foreground changes; `backgroundTaskService` — periodic background tasks (WorkManager);
app-update's `apkInstallerService` — the update APK's download into the app cache, Android's
installer, and cleanup). calendar's `calendarService` does no I/O but keeps the same boundary:
Shabbat times and months computed on the phone from `src/lib/jewish-calendar/`, returned as plain
JSON (times as ISO strings) so Redux state stays serializable.

`authSlice` stores the `refreshToken` that register/login return; it renews the session (see
"Staying signed in" above) and is revoked by `logOut`.

## apk

The APK registry: `caddy:2-alpine` (`devops/apk/docker-compose.yml` + `devops/apk/Caddyfile`)
serving `devops/data/apk` read-only at `/apk/` (`/` and `/apk` redirect there), published on
`127.0.0.1:8081`, which `tailscale serve` puts at `https://<pc>.ts.net/apk/`. No API, no logic: the
files are written by `node devops/android/apk.js publish` (every published APK, `releases.json`,
`latest.json`, the `index.html` download page — `frontend/README.md`'s "APK registry"). `.apk`
files go out as `application/vnd.android.package-archive`; the page and `latest.json` with
`Cache-Control: no-cache`, so a new release shows at once. The installed app's update check reads
`latest.json` and downloads the APK from here (see [frontend](#frontend)'s "App update").

## Versions

`version/versions.json` (repo root) holds one version per deployable component (`frontend`,
`gateway`, `users`), each its own. Bumped only by
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
`/app/version/versions.json`, plus its build time in `/app/version/built-at`. Users answers
`GET /health` (compose healthcheck; internal-only) with:

```json
{ "status": "ok", "service": "users", "version": "0.1.0",
  "builtAt": "2026-10-05T18:00:00Z", "startedAt": "2026-10-05T18:02:11.123Z" }
```

([`@app/build-info`](#libsbuild-info).) `apk.js build` bakes the frontend's version and build time
into the APK (`EXPO_PUBLIC_FRONTEND_VERSION`/`EXPO_PUBLIC_BUILT_AT`; the version also sets
Android's `versionCode`), shown by the
(hidden) Account tab's `VersionInfo` (and at the bottom of the hidden Admin tab, which lists the
backend services' versions from `GET /admin/status`).

## libs/auth-kernel

Shared JWT sign/verify (`IJwtService`/`JsonWebTokenService`, the only class allowed to import
`jsonwebtoken`), the higher-level `IAuthTokenService`/`AuthTokenService` used by every guard,
`JwtAuthGuard` (any role in `USER_ROLES`) and
`AdminGuard` (`JwtAuthGuard` + admins only → `403`). Used by `apps/users` (signs, on
login/register/refresh/account) and `apps/gateway` (verifies — `JwtAuthGuard` on every
`auth: 'user'` row of `PROXY_ROUTES`, `AdminGuard` on `GET /admin/status`). Also `USER_ID_HEADER` +
`@ForwardedUserId()`, the internal-service side of Gateway's forwarded user id (see Gateway above)
— used by `apps/users`.

## libs/build-info

`buildInfo(service)` → `{ service, version, builtAt, startedAt }`. Reads `versions.json` and
`built-at` from the first of `./version`, `../version` that has a `versions.json` —
so a local `nest start` from `backend/` reads the repo's own file, with `builtAt` `null` (nothing
writes `built-at` outside Docker). Missing entry or file → `null`. `startedAt` is fixed at module
load.

## libs/otel

`startOtel` (traces, metrics and logs over OTLP/gRPC to the collector), `OtelLogger`,
`createRequestLoggingMiddleware` and `installGracefulShutdown` — generic, ported unmodified from
`ask-my-crawl`. Each app's `main.ts` imports it before anything else (the file header of
`libs/otel/src/start-otel.ts` says why). Its variables: `docs/backend/environment.md`.

## Calendar maths

`frontend/src/lib/jewish-calendar/` — all of the app's Jewish-calendar maths, on the phone.
`@hebcal/core` v6, imported only under `hebcal/` (`HebcalCalendarCalculator` behind
`ICalendarCalculator`, and `hebrew-dates.ts`); `ShabbatCalendar` (`IShabbatCalendar`),
`MonthCalendar` (`IMonthCalendar`) and `ReminderOccurrences` (`IReminderOccurrences`) are the
entry points, pure and synchronous. Home's times and the Calendar tab's months go through
calendar's `calendarService`, the reminders' days and firings through `reminders/utils/` — so
Home, the calendar and reminders always agree, and a rule changes in one place
(`calendar-options.ts` picks the candle-lighting minutes for all of them).

- `current(location, now)` — the Shabbat in progress at `now`, otherwise the next one: candle
  lighting, Havdalah, parasha, holidays, `isNow`. The Shabbat that started last Friday is returned
  while it's still running — including through a Yom Tov directly after it (`havdalah` can be
  Sunday night when a Yom Tov falls on Sunday). `parasha` is `null` when a holiday replaces the weekly reading;
  `holidays` lists what falls on that Saturday, minus eves, modern civic days and Leil Selichot.
  Names come in English and unvoweled Hebrew, tidied where hebcal's read badly
  (`holiday-names.ts`: "Rosh Hashana I" without the year, "Sukkot · day 3 (Chol HaMoed)" for
  Sukkot/Pesach II–VI (CH''M), "Hoshana Raba" for Sukkot VII).
- `nextCandleLighting(location, after)` — the first Friday candle lighting strictly after `after`.
  Weeks with no sunset are skipped; throws `InvalidLocationError` only after 26 such weeks in a row
  (or from `current` when this week has none).
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
  (`ISRAEL_TIME_ZONE`) wherever the point is — "today" is the date in Israel, never the device's,
  and a point abroad gets Israel's rules with that spot's sunset. Candle lighting is 20 min before
  sunset — 40 in Jerusalem and Petach Tikva, 30 in Haifa, Tzfat and Zikhron Ya'akov (OU Israel /
  MyZmanim), matched by distance from the city center (`israel-city-customs.ts`; the radius is
  approximate, so a town right next to a city can count as it). Havdalah is Hebcal's default (sun 8.5° below the horizon).

See `frontend/src/lib/jewish-calendar/README.md` for the non-obvious implementation details
(`@hebcal/core` on Hermes and Jest, the device's time zone, finding Havdalah, reminders' repeat
rules).
