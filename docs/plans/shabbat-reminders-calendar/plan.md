# Plan: Shabbat times, reminders, Jewish calendar

Branch: `feature/shabbat-and-calendar`
Design files in this folder (open in a browser; they're the source of truth for the look and the
wiring, so read them before starting a task):
- [`architecture.html`](architecture.html): service diagram, reminder flow, queue message,
  endpoints. Also published at https://claude.ai/artifact/Y4Q7eRQ87dEDa3M8DgptPN
- [`mockups.html`](mockups.html): UI options. Chosen: **H1** "Times under the clock" and **C1**
  "Month grid + day card". Also published at https://claude.ai/artifact/JuiUxtsAeyXPk6SCYPgMLe

If a design changes, update the HTML file here in the same commit.

## How we work through this plan

- One task at a time. After each task: stop, summarize what changed and how to check it, and wait.
- Move to the next task, or the next stage, **only when the user says so explicitly**.
- Tick a task's box when it's done. **Never stage or commit** — leave changes unstaged for review;
  the user decides when to stage/commit and says so explicitly.
- If a task turns out bigger than expected, split it here first rather than doing it all at once.

## Decisions already made

- **Exact location**, not a fixed city: the phone reads GPS via `expo-location` (and, signed in,
  syncs it to the server for reminders — see "Location follows the phone" below).
- **All calendar calculation is on the server, in one library.** `@app/jewish-calendar`
  (`@hebcal/core`) holds every rule; Gateway serves Home's `GET /calendar/shabbat` from it directly
  (the one Gateway route that isn't a proxy) and the Reminders scheduler uses it in-process. One
  implementation keeps Home, the calendar and reminders in agreement, and a rule changes in one
  place. (It replaced a separate Calendar Service; computing on the phone was tried and dropped —
  it meant keeping the rules in two codebases.) Stage 3's `/calendar/month` goes in Gateway's
  calendar module too.
- **Israel vs. abroad** comes from the time zone (`Asia/Jerusalem`). Candle lighting is **20 minutes
  before sunset in Israel, 18 abroad** (set explicitly; `@hebcal/core` would otherwise silently
  swap 18→20 in Israel). **City customs by location:** Jerusalem and Petach Tikva 40, Haifa, Tzfat
  and Zikhron Ya'akov 30 (per OU Israel / MyZmanim — Hebcal's own list misses Petach Tikva and
  Tzfat), matched by distance from the city center (`israel-city-customs.ts`). A per-user minutes
  setting may come later for communities that differ.
- **`@hebcal/core` v6** (ESM-only). Imported via its `@hebcal/core/dist/esm/index` subpath so the
  CommonJS backend can `require()` it on Node 22; Jest compiles it to CJS (`backend/jest.config.js`).
  v5 was tried and rejected: its type declarations don't resolve under `nodenext`.
- **Reminders are per user** (login required, user id from the JWT). The first type is "before
  candle lighting", with a user-picked offset (e.g. 1h 30m), repeating weekly.
- **Reminders → BullMQ (Redis) → Notifications.** Reminders decides *when* and enqueues a
  `notification-requested` job (deduplicated by `notificationId` until its `expiresAt`). The
  Notification Service decides *how* (push first; email/SMS later as new adapters, with no change
  to Reminders). One job per notification; a retry skips the devices the job already reached
  (saved in its progress). Replaced Kafka for this (task 2.3): per-job retries,
  dedupe and delayed jobs fit this better, and Redis was already running. Kafka came back later
  for events only (see below).
- **Push = Web Push, encrypted, no Expo.** The phone's browser (Chrome or Brave, on the HTTPS
  tailnet site) subscribes; the Notification Service sends through the browser's push service with
  the payload end-to-end encrypted (RFC 8291, `aes128gcm`) using keys only the phone holds. The push
  service (Google) sees timing, size, and which server talks to which subscription — never the text.
  Our own VAPID key pair identifies the server; nothing goes through Expo. A native-app channel can
  be added later as another adapter.
- Every new service is internal-only (no published port). Only Gateway is reachable from outside.
- **Kafka for events, BullMQ for jobs.** A fact that services may need to react to ("this user's
  profile changed") goes on a Kafka topic; each service reads it with its own consumer group. Work
  that runs once, possibly delayed or in parallel (`notification-requested`, a reminder's next
  firing), stays a BullMQ job. Kafka was brought back for this in task 2.6.
- **One database, a schema per service.** Every service uses the one `personal_copilot` database,
  in its own schema (`users.*`, `reminders.*`, `notifications.*`). A service only ever writes its
  own schema; it may read another's tables directly (a read-only TypeORM mapping,
  `synchronize: false`, so it never creates or alters them). Ownership is a convention, not
  database roles. Replaced one database per service (task 2.10).
- **Users, location and events.** One Users Service (the Auth Service, renamed) owns both how you
  log in (`users`, `refresh_tokens`) and who you are (`profiles`: first and last name, phone,
  location; keyed by the user id, the JWT `sub`). Account and profile are created in one
  transaction. Other services read `users.profiles` when they need a location — no copies. Every
  profile change is announced on a compacted `users.user-state` topic (through an outbox saved in
  the same transaction, so none is lost), which is how Reminders knows to reschedule.
- **Deleting an account cascades.** Other services' tables reference `users.users(id)` with
  `ON DELETE CASCADE`, so deleting the user removes their reminders and push subscriptions in the
  same transaction. No delete event.
- **Location follows the phone.** Signed in, the phone sends its location only when it moved more
  than 5 km or the time zone changed. The server knows where the app was last opened (a web app
  can't read GPS in the background). Two phones in two places: the last update wins. Signed out,
  Home uses the phone's GPS directly, as before.
- **No "server → open app" channel for this.** The phone is the one that changes the location, so
  it re-fetches what depends on it. Web Push is for notifications only (every push must show one).
- **Versions, the Android app and ntfy** (added before stage 3, tasks 2.17–2.26). The frontend
  has a semver version and Android `versionCode`, bumped by one script that tags git; each backend
  service reports its version, build commit and start time on `/health`, and an Admin tab (admin
  accounts only) shows them all with up/down status. The phone gets a real Android app (APK),
  built in Docker and signed with one key kept outside git, published to a registry at
  `https://<pc>.ts.net/apk/`; the app checks it on start and offers updates. The APK can't use
  Web Push (browser-only), so its reminders go through a self-hosted **ntfy** server on the
  tailnet and the ntfy Android app — a second Notification Service channel, no Reminders change,
  no Google account. Web Push stays for the browser.

---

## Stage 1: Shabbat times on the Home clock + all services set up

Goal: the Home card shows the next Shabbat's candle lighting and Havdalah for your real location,
with a countdown. The Reminders and Notification services exist and run, but do nothing yet.

- [x] **1.1 Calendar Service skeleton.** `backend/apps/calendar` registered in `nest-cli.json`,
  API / Application / Infrastructure / models layout like `apps/auth`, OTel wired, a health route,
  `devops/calendar/docker-compose.yml` with no published port, included in the app stack.
  *Check:* container starts and is healthy; not reachable from the host.
- [x] **1.2 Shabbat calculation.** `ICalendarCalculator` (infrastructure interface) +
  `HebcalCalculator` (infrastructure, `@hebcal/core`). `GET /calendar/shabbat?lat&lon&tz` returns
  the next or current Shabbat: candle lighting, Havdalah, parasha, and any holiday on that Shabbat.
  Input validation (lat/lon ranges, valid IANA tz).
  *Tests:* Tel Aviv on a normal week; Jerusalem; a place abroad (e.g. New York); a request made
  during Shabbat (returns the current one); a Shabbat that's also a holiday.
- [x] **1.3 Gateway `calendar-proxy`.** Same shape as `auth-proxy`: one explicit route, no auth
  guard (works while signed out), rate-limited.
  *Check:* `curl` through Gateway returns the same result as 1.2.
- [x] **1.4 Reminders Service skeleton.** `backend/apps/reminders`: layering, OTel, health, its
  own Postgres database, compose file with no published port. No endpoints yet.
- [x] **1.5 Notification Service skeleton.** `backend/apps/notifications`: same as 1.4. No
  endpoints or consumer yet.
- [x] **1.6 HTTPS for the web app.** `tailscale serve` in front of the frontend and Gateway so a
  phone browser allows GPS. Update `.env.example` / `GATEWAY_PUBLIC_URL` and the README.
  *Check:* the site opens over `https://<pc>.ts.net` from the phone.
- [x] **1.7 Frontend location.** Add `expo-location`, a `locationSlice` (coords + tz, cached),
  permission request on first use. If permission is denied, the Shabbat section shows a short
  "Location is off" message with a retry button.
- [x] **1.8 Home card Shabbat section (H1).** `services/http/calendarService`, `calendarSlice` thunk,
  the section under the clock: label, candle lighting, Havdalah, countdown. During Shabbat it
  shows "Shabbat Shalom · ends HH:MM". The last result is cached so it still shows offline.
- [x] **1.9 Docs sync.** `docs/specs/*`, `CLAUDE.md`, READMEs (via the `docs` agent).

## Stage 2: Candle-lighting reminder

Goal: on the Home card, a bell button lets a logged-in user pick "remind me X before candle
lighting", and a push notification arrives on the phone at that time every Friday. Then (2.17 on):
versions, an admin status view, and an installable Android app that updates itself from the home
network and gets its reminders through ntfy.

- [x] **2.0 Fix Kafka.** `devops/data/kafka` is owned by root, so the broker crash-loops. Give it to
  the container's user (one `sudo chown`, run by the user) and confirm the broker stays up.
- [x] **2.1 Kafka contract + consumer.** `notification.requested` topic and message type in
  `libs/kafka-contracts` (`notificationId`, `userId`, `title`, `body`, `url?`, `channels?`,
  `source`, `requestedAt`), the `kafka-init` topic in `devops/kafka`, and a generic consumer in
  `libs/kafka-client` (it only has a publisher today).
- [x] **2.2 Notification Service: push subscriptions.** `push_subscriptions` table (`user_id`,
  `endpoint` unique, `p256dh`, `auth`, `created_at`). `GET /notifications/vapid-public-key` (open —
  the browser needs it to subscribe), `POST /notifications/subscriptions` and
  `DELETE /notifications/subscriptions` (user from the JWT). VAPID keys generated once, kept in
  env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Gateway `notifications-proxy`.
- [x] **2.3 Notification Service: sending.** BullMQ consumer for `notification-requested`
  (`@app/queue-client`, contract in `@app/queue-contracts`, required `expiresAt`, expired jobs
  skipped), `INotificationChannel` interface, `WebPushChannel` sending to each of the user's
  devices, the whole job retried with backoff until `expiresAt` for devices not reached yet (job
  progress records the ones done), `web-push` sender, delete a subscription the push
  service reports gone (404/410).
  *Proof test:* capture the request sent to the push service and assert
  `Content-Encoding: aes128gcm` and that the reminder text does not appear anywhere in the body or
  headers. *Check:* enqueueing a test job by hand reaches the real push service (FCM). Seeing it on the phone needs 2.14's service worker, so that
  check moves to 2.14.
- [x] **2.4 Calendar: next candle lighting after a date.** An internal route Reminders uses to
  find the next candle-lighting time for a saved location. Not exposed through Gateway.
  `GET /calendar/candle-lighting/next?lat&lon&tz&after` → `{ candleLighting }`, strictly after
  `after`; skips weeks with no sunset.
- [x] **2.5 Reminders Service: storage + API.** `reminders` table (`user_id`, `type`,
  `offset_min`, `lat`, `lon`, `tz`, `enabled`, `next_fire_at`). `GET /reminders`,
  `PUT /reminders/shabbat-candles`, `DELETE /reminders/shabbat-candles`, user from the JWT. Gateway
  `reminders-proxy` with `JwtAuthGuard`.
### Users service and events

A reminder must follow the user when they move, so location moves out of the reminder into a
per-user record that every service can rely on without calling for it. See "Users, location and
events" under Decisions.

- [x] **2.6 Kafka back, for events.** Restore `devops/kafka` (broker + `kafka-init` topics),
  `KAFKA_BROKERS`, `kafkajs`, and the build wiring (`tsconfig.json` paths, `nest-cli.json`,
  `jest.config.js`) for the restored `libs/kafka-client` and `libs/kafka-contracts`. Add an outbox
  helper to `kafka-client` (the change and its event saved in one transaction, a relay publishes
  them). Contracts in `kafka-contracts`: `users.user-state` (compacted, keyed by user id) and
  `users.user-deleted`. Drop the old Kafka `notification-requested` message (it lives in
  `queue-contracts` now).
  *Check:* the broker stays up (see 2.0); a round trip through each topic.
- [x] **2.7 Rename Auth Service → Users Service.** No behavior change: `apps/auth` → `apps/users`,
  `devops/auth` → `devops/users`, the Docker service, `AUTH_SERVICE_URL` → `USERS_SERVICE_URL`,
  `docs/auth` → `docs/users`, scripts and docs. Its database stays `personal_copilot` (renaming a
  database means moving its data); the `users` table keeps its name. Public routes don't change:
  `/auth/*` stays, Gateway's `auth-proxy` now forwards to the Users Service.
  *Check:* register, login, refresh, logout and account still work through Gateway.
- [x] **2.8 Users Service: profiles + events.** `profiles` table: `user_id` (primary key, the
  user's id, deleted with the user), `first_name`, `last_name`, `phone` (international format),
  `lat`, `lon`, `tz`, `location_updated_at`, `version`. `register` takes optional `firstName`,
  `lastName`, `phone` and creates the profile in the same transaction; an existing account without
  a profile gets one on its first profile write. `GET /users/me`, `PATCH /users/me` (name, phone),
  `PUT /users/me/location` (`{ lat, lon, tz }`). `DELETE /auth/account` (`{ email, currentPassword
  }`, immediate). Outbox: every profile change publishes the full state to `users.user-state`; a
  delete publishes `users.user-deleted` and a `users.user-state` tombstone. Gateway `users-proxy`
  (`JwtAuthGuard`) and the new `auth-proxy` route.
- [x] **2.9 Reminders: location from events.** Drop `lat`, `lon`, `tz` from `reminders`; `PUT
  /reminders/shabbat-candles` takes only `{ offsetMinutes }`. Keep a `user_locations` copy filled
  from `users.user-state` (newer `version` wins, older ignored). On `users.user-deleted`, delete the
  user's reminders and location. A reminder for a user with no location yet is saved but can't be
  scheduled; `GET /reminders` says so.
  *Partly undone by 2.10:* with one database, the `user_locations` copy and `users.user-deleted`
  go away.
- [x] **2.10 One database, a schema per service.** `devops/postgres`'s `postgres-init` creates the
  `users`, `reminders` and `notifications` schemas in `personal_copilot` instead of separate
  databases; every service uses `DATABASE_URL` plus its own `schema` (`REMINDERS_DATABASE_URL` and
  `NOTIFICATIONS_DATABASE_URL` go away). Everything starts fresh (only test data so far): the old
  `public` tables and `reminders`/`notifications` databases are dropped by hand.
  Reminders: drop `user_locations` and its Kafka consumer (the scheduler, 2.13, adds a
  `users.user-state` listener back just to reschedule), read the location from `users.profiles`
  for `waitingForLocation`. `reminders.user_id` and `push_subscriptions.user_id` become foreign
  keys to `users.users(id)` with `ON DELETE CASCADE` (so a reminder can't exist for a deleted
  user). Drop `users.user-deleted` (topic, contract, outbox event); a delete still publishes the
  `users.user-state` tombstone.
  *Check:* deleting an account removes its reminders and push subscriptions.
- [x] **2.11 Frontend: account.** Optional first name, last name, phone on the register form; an
  edit-profile section on the Account tab (`GET`/`PATCH /users/me`); a "Delete account" button that
  asks for the password and logs out.
- [x] **2.12 Frontend: location sync.** When signed in, send `PUT /users/me/location` only when the
  phone moved more than 5 km from the last location sent or its time zone changed.

### Candle-lighting reminder

- [x] **2.13 Reminders Service: scheduler.** BullMQ delayed jobs instead of polling: when a
  reminder is saved (or fires), compute its next fire time from the next candle lighting at the
  user's location (read from `users.profiles`) and enqueue a job delayed until then (dedupe id per
  reminder + date). At fire time it enqueues `notification-requested` (`expiresAt` = candle
  lighting) and schedules next week's. Changing the offset, or a `users.user-state` event (the
  location may have changed), replaces the pending delayed job. The `reminders` rows stay the
  source of truth; on startup, reschedule any enabled reminder with no pending job. A job whose
  reminder is gone (account deleted) does nothing.
  *Tests:* fires once, not twice; survives a restart; offset change moves the next time; a
  location event moves the next time.
- [x] **2.14 Frontend: turn on notifications.** A service worker in the web build (receives the
  push, shows the notification, opens the app on tap), a "Turn on notifications" step after login
  that asks permission and calls `PushManager.subscribe` with the VAPID public key, and sends the
  subscription to 2.2. Web only for now.
  *Check:* a `notification-requested` job enqueued by hand shows on the phone.
- [x] **2.15 Frontend: bell button + offset sheet.** On the H1 Shabbat section: hours/minutes
  picker, presets (30m, 1h, 1h 30m, 2h, 3h), "fires at HH:MM this week" (the server's
  `nextFireAt`), Save (sends only the offset) / Turn off. Signed out → the existing "log in to use
  this" prompt. `remindersSlice` + `remindersService`.
- [x] **2.16 End-to-end check on the phone + docs sync.** Real reminder a few minutes out, received
  in the phone's browser over `https://<pc>.ts.net`; moving the location moves it.

### Versions, admin status, Android app

Added after 2.16, before stage 3: version numbers, an admin view of the backend, an installable
Android app (APK) with updates from the home network, and reminders on that app through a
self-hosted ntfy server. See "Versions, the Android app and ntfy" under Decisions.

- [x] **2.17 Admin sign-in + sessions that end cleanly.** Today the seeded admin can log in but
  Gateway rejects every `role: 'admin'` token (`auth-kernel` accepts only `'user'`), so the app
  gets stuck "signed in" with every call failing (found while testing 2.14). `auth-kernel`: verify
  `'user'` and `'admin'`; `JwtAuthGuard` lets both through (the admin also uses the app as a
  normal user), a new `AdminGuard` only `'admin'`. Frontend: `selectUser` exposes the role; any
  `401` from a signed-in call signs out with "Your session ended — please log in again" (also
  covers an expired or otherwise rejected token).
  *Tests:* an admin token passes `JwtAuthGuard` and `AdminGuard`, a user token fails
  `AdminGuard` with `403`; in the browser, a rejected token signs out with the message.
- [ ] **2.18 Versions.** The frontend has a semver version (`frontend/app.json` `version`, plus
  Android's `versionCode`, which only goes up), bumped by one script
  (`scripts/release.sh <x.y.z>`) that also tags git (`app-v<x.y.z>`). The Account tab shows
  "Version 1.2.0 (abc1234)" (build commit baked in at build time). Every backend service reports
  `{ status, version, commit, startedAt }` on `GET /health`: `version` from `backend/package.json`,
  `commit` baked into its image at build time (a build arg), so a stale container is visible.
  *Check:* rebuild one service, its `/health` shows the new commit and start time.
- [ ] **2.19 Admin: system status.** Gateway `GET /admin/status` (`AdminGuard`): asks every
  backend service's `/health` (its own, Users, Reminders, Notifications — the list from Gateway's
  config) in parallel with a short timeout and returns `[{ service, status: 'up' | 'down', version,
  commit, startedAt, latencyMs }]`; a service that doesn't answer is `down`, not an error.
  Frontend: an **Admin** tab, only for admins (a `requiresRole: 'admin'` tab, hidden for
  everyone else, and the same mount-time check as Account), listing each service with an up/down
  chip, version, commit, uptime and latency, plus the app's own version; refresh on open and by
  pull/tap. **New UI → HTML mockup first.**
  *Check:* stop the Reminders container — it shows `down` within one refresh; start it — `up`
  with a new start time.
- [ ] **2.20 Android app (APK) builder.** `app.json` gets the Android identity
  (`android.package`, `versionCode`, permissions: location, notifications). A Docker image
  (`devops/android/`: JDK 17, Android SDK, Node 22 — nothing installed on the host) runs
  `expo prebuild --platform android` and Gradle `assembleRelease`, with
  `EXPO_PUBLIC_GATEWAY_ORIGIN` = the tailnet Gateway URL. Signed with one release keystore,
  generated once into `devops/data/android/` (git-ignored — **back it up**: an APK signed with a
  different key can't update the installed one). One command: `devops/android/build-apk.sh` →
  `personal-copilot-<version>.apk`. Web-only code (`sw.js`, Web Push) stays web-only; on the APK
  the Notifications card says "coming with 2.25" until then.
  *Check:* the APK installs on the phone (Tailscale on), logs in, shows Shabbat times from GPS,
  and the reminder sheet saves.
- [ ] **2.21 APK registry on the tailnet.** `https://<pc>.ts.net/apk/`, served by the frontend's
  Caddy from a persistent folder (`devops/data/apk/`, mounted, so it survives frontend rebuilds —
  no new port). Holds every published APK, `latest.json` (`{ version, versionCode, url, sha256,
  notes, publishedAt }`) and a plain download page listing versions, newest first, with their
  notes. `devops/android/publish-apk.sh` (or a flag on `build-apk.sh`) copies the APK in and
  rewrites `latest.json` and the page. **The page is new UI → HTML mockup first.**
  *Check:* the page opens on the phone, downloads the newest APK and installs it; an older one is
  still listed.
- [ ] **2.22 In-app update prompt (APK only).** On start and when the app comes back to the
  foreground, the APK fetches `/apk/latest.json`; if its `versionCode` is newer than the installed
  one (`expo-application`), a prompt: "Version 1.3.0 is available · What's new · Update / Later".
  Update opens the APK's URL, Android downloads it and asks to install (the first time it asks to
  allow installs from that browser). "Later" waits for the next version. The web build never
  shows it (it's always the newest). **New UI → mockup first.**
  *Check:* install 1.0.0, publish 1.0.1 — the prompt shows; Update installs over it keeping the
  login; 1.0.1 shows no prompt.
- [ ] **2.23 ntfy server.** `devops/ntfy/` (the official `binwiederhier/ntfy` image): cache and
  auth on disk under `devops/data/ntfy/`, `auth-default-access: deny-all` (nothing readable or
  writable without a token), an admin user for the Notification Service. The phone's ntfy app has
  to reach it, so `tailscale serve` publishes it on `https://<pc>.ts.net:8445` — tailnet only,
  like the frontend; the second deliberate exception to "only Gateway is reachable" (a push
  server, not an API — **needs your OK**, see Open questions).
  *Check:* the ntfy app on the phone subscribes to a test topic with a token and gets a message
  `curl`ed from the PC; without a token it's refused.
- [ ] **2.24 Notification Service: ntfy channel.** `ntfy_topics` table (`user_id` → `users.users`
  `ON DELETE CASCADE`, a random unguessable `topic`, created per user on first use) and a
  read-only ntfy token per user for that topic only (via ntfy's admin API).
  `POST /notifications/ntfy` (JWT, through Gateway) → `{ server, topic, token }`, creating them
  if needed; `DELETE` removes them and revokes the token. `NtfyChannel implements
  INotificationChannel` (channel `'ntfy'` in `queue-contracts`): publishes title, body and a click
  link back into the app (`personalcopilot://`, the app's scheme) to the user's topic; per-job
  progress and retries like `WebPushChannel`. Reminders doesn't change (it already omits
  `channels`, meaning every channel the user has).
  *Tests:* the channel publishes to the right topic with the token; a deleted account's topic and
  token go. *Check:* a hand-enqueued `notification-requested` shows in the ntfy app.
- [ ] **2.25 APK: turn on notifications (ntfy).** On the APK, the Notifications card and the
  after-login prompt use ntfy instead of Web Push: "Turn on" calls `POST /notifications/ntfy`, then
  opens the ntfy app's subscribe link for that server, topic and token (or, if the ntfy app isn't
  installed, explains and links to it on F-Droid / Google Play). Tapping a notification in the
  ntfy app opens our app. Off → `DELETE`. **Changed UI → update the 2.14 mockup first.**
  *Check:* a reminder fired by hand (`fire-reminder-soon.sh`) arrives with the phone locked and
  our app closed; tapping it opens the app.
- [ ] **2.26 End-to-end on the phone + docs sync.** Install the APK from the registry, update it
  once through the in-app prompt, receive a real reminder through ntfy with the phone locked, and
  see every service up (and one stopped as down) on the Admin tab. Docs: `CLAUDE.md` (it says
  "no admin features" today), `docs/specs/*`, READMEs, the agents' files.

## Stage 3: Calendar tab

Goal: a new Calendar tab with a month grid (Gregorian + Hebrew dates, dots for holidays and fasts)
and a day card with that day's times.

- [ ] **3.1 Calendar: month endpoint.** `GET /calendar/month?year&month&lat&lon&tz` in Gateway's
  calendar module (`src/calendar/`, `@app/jewish-calendar` in-process — no separate service to
  route to; open, rate-limited like `/calendar/shabbat`): every day's Hebrew date, holidays/fasts,
  and enter/leave times where they apply. Tests for an Israel month and an abroad month (two-day
  Yom Tov). (Absorbs the old "3.2 Gateway route".)
- [ ] **3.2 Frontend: Calendar tab + month grid.** New `(tabs)/calendar`, both dates per cell,
  holiday/fast dots, month arrows, today highlighted.
- [ ] **3.3 Frontend: day card.** Tapping a day shows its name (English + Hebrew) and times.
- [ ] **3.4 Holiday-eve reminders (if wanted).** An "Include holidays" switch on the reminder
  sheet, so it also fires before candle lighting on the eve of a holiday.
- [ ] **3.5 Docs sync.**

---

## Open questions

Smaller bugs, config fixes and ideas found along the way are tracked in
[`open-issues.md`](open-issues.md).

- **ntfy reachable from the phone** (task 2.23): OK to publish ntfy on its own tailnet port
  (`:8445`, tailnet only) — a second exception, like the frontend, to "only Gateway is reachable"?
  The alternative, proxying ntfy's long-lived connections through Gateway, is possible but adds
  load and code to Gateway for no privacy gain on a tailnet.
- **ntfy delivery on Android:** without Google, the ntfy app keeps its own connection open (a
  small, permanent "ntfy" notification and some battery). Acceptable? (ntfy can also use Firebase
  for instant delivery, which would bring Google back in.)
- **Release key backup:** where do you want the APK signing key backed up? Losing it means
  uninstalling the app (and signing in again) to install any newer version.
- **Holiday eves for the reminder** (task 3.4): yes or no?
- **Location denied:** is the "Location is off" message enough, or do you want a manual city
  picker as a fallback?
