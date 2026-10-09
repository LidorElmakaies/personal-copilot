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
  Our own VAPID key pair identifies the server; nothing goes through Expo. The Android app (APK)
  has its own channel, FCM (see below).
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
- **Versions, the Android app and FCM** (added before stage 3, tasks 2.17–2.27). One
  `version/versions.json` holds the app's version and one per deployable component (semver,
  `-test.N` for test builds), bumped by one script that never touches git; each image bakes in its
  own version and build time, backend services report them with their start time on `/health`, and
  an Admin tab (admin accounts only) shows them all with up/down status. Android's `versionCode` is
  computed from the frontend version. The phone gets a real Android app (APK),
  built in Docker and signed with one key kept outside git, published to a registry at
  `https://<pc>.ts.net/apk/`; the app checks it on start and offers updates. The APK can't use
  Web Push (browser-only), so its reminders go through **Firebase Cloud Messaging (FCM)**, Google's
  free Android push — a second Notification Service channel, no Reminders change. The Notification
  Service sends straight to FCM's HTTP API (no Expo push service); each message is encrypted with a
  key only that phone holds, so Google sees timing and size, never the text — the same as Web Push
  in Chrome, which already rides on FCM. No server to run, no new exposed port, no permanent
  notification on the phone. Web Push stays for the browser.
- **Phones: Android gets the APK, iPhone the Home Screen web app.** Both run the same Expo code.
  iPhones can't install apps from our own server (only through Apple), so the APK, its registry,
  the in-app updater and FCM are **Android only**. iPhone uses the web app installed to the Home
  Screen (a PWA: web manifest + icons) — iOS 16.4+ delivers Web Push to Home Screen web apps
  through Apple's push service, so reminders reach it through the Web Push we already have (FCM
  on iPhone would need a native app). **No native iOS app**: it needs the paid Apple Developer
  Program, and isn't planned.
- **Ready to move to the cloud.** Today everything runs at home behind Tailscale. Anything new must
  also work if the whole project moves to a public cloud server: nothing may rely on the tailnet
  being private for its security. FCM needs nothing exposed: the Notification Service only calls
  out to Google.

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
versions, an admin status view, an installable Android app that updates itself from the home
network and gets its reminders through FCM, and the iPhone as a Home Screen web app.

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
Android app (APK) with updates from the home network, reminders on that app through FCM, and the
iPhone as a Home Screen web app. See "Versions, the Android app and FCM", "Phones" and "Ready to
move to the cloud" under Decisions.

- [x] **2.17 Admin sign-in + sessions that end cleanly.** Today the seeded admin can log in but
  Gateway rejects every `role: 'admin'` token (`auth-kernel` accepts only `'user'`), so the app
  gets stuck "signed in" with every call failing (found while testing 2.14). `auth-kernel`: verify
  `'user'` and `'admin'`; `JwtAuthGuard` lets both through (the admin also uses the app as a
  normal user), a new `AdminGuard` only `'admin'`. Frontend: `selectUser` exposes the role; any
  `401` from a signed-in call signs out with "Your session ended — please log in again" (also
  covers an expired or otherwise rejected token).
  *Tests:* an admin token passes `JwtAuthGuard` and `AdminGuard`, a user token fails
  `AdminGuard` with `403`; in the browser, a rejected token signs out with the message.
- [x] **2.18 Versions.** One file, `version/versions.json`: `app` (the whole project, grows with
  every change) and one version per deployable component (`frontend`, `gateway`, `users`,
  `reminders`, `notifications`), all starting at `0.1.0` (in development; `1.0.0` is declared
  when version 1 is ready). Semver `MAJOR.MINOR.PATCH`, `-test.N`
  for test builds while fixing (`1.3.0-test.1` … then the release `1.3.0`); bumping one part
  resets the ones to its right. `scripts/version.sh <component> major|minor|patch [--test] |
  release` applies the rules and bumps `app` the same way (no git; it prints the tag to add after
  committing). Images get the version through a small `version` build context: each backend image
  bakes in only its own version plus its build time (so bumping one service doesn't rebuild the
  others), reported on internal services' `/health` as `{ status, service, version, builtAt,
  startedAt }` (`@app/build-info`); Gateway's public routes don't expose it (2.19 reads it
  in-process). The frontend bakes in the app and frontend versions and its build time and shows
  them at the bottom of the Account tab. Rule in `CLAUDE.md`: after every change, ask the user
  which components to bump. (Android's `versionCode`, computed from the frontend version,
  `major·1,000,000 + minor·10,000 + patch·100 + test number, or 99 for a release`, comes with the
  APK in 2.20; the build commit was dropped — no git inside the builds — the build time shows a
  stale container just as well.)
  *Check:* bumping Reminders and rebuilding changed only Reminders' version and build time.
- [x] **2.19 Admin: system status.** Gateway `GET /admin/status` (`AdminGuard`): reads its own
  build info in-process (`@app/build-info`) and asks Users', Reminders' and Notifications' `/health`
  (the list from Gateway's config) in parallel with a short timeout; returns `[{ service, status:
  'up' | 'down', version, builtAt, startedAt, latencyMs }]`; a service that doesn't answer is `down`, not an error.
  Frontend: an **Admin** tab, only for admins (a `requiresRole: 'admin'` tab, hidden for
  everyone else, and the same mount-time check as Account), listing each service with an up/down
  chip, version, build time, uptime and latency, plus the app's own version; refresh on open and by
  pull/tap. **New UI → HTML mockup first** (chosen: A2, summary + compact list).
  *Check:* stop the Reminders container — it shows `down` within one refresh; start it — `up`
  with a new start time.
- [x] **2.20 Android app (APK) builder** (Android only). `app.json` gets the Android identity
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
- [x] **2.20a Android look check (screenshots from the user).** The APK runs, but some effects and
  borders look wrong on the phone (found while testing 2.20). **Ask the user first** to take
  screenshots on the phone of every screen and state — Home (signed out and in, with the reminder
  sheet open), login/register, Account (every card), Admin, the confirm prompts, both themes — and
  send them over; don't guess from the web build. Then fix what differs from the web look and the
  mockups: likely suspects are `GlowCard`'s blur/gradient border (`expo-blur` renders differently
  on Android), shadows and glows (`elevation` vs `shadow*`), hairline borders, the tab bar's blur,
  and the monospace font. Fixes must keep the web build looking the same.
  *Check:* the user's new screenshots of the same screens look right to them; the web e2e tests
  still pass.
- [x] **2.20b App icon** (APK and web). The app has no icon of its own (the APK shows Expo's
  default). Design one: **new UI → HTML mockup first** with a few icon options to pick from, shown
  on light and dark backgrounds and at small sizes. Then the files every platform needs from that
  one design: Android's adaptive icon (foreground + background layers, `android.adaptiveIcon` in
  `app.json`), the splash icon, and the web set 2.26 links (192/512 px, maskable, Apple's 180 px
  `apple-touch-icon`, favicon). The source (SVG) lives in the repo so sizes can be regenerated.
  *Check:* the rebuilt APK shows the icon on the phone's home screen and app list (round and
  squircle masks both fine); the web build's tab shows the favicon.
- [x] **2.21a APK registry: serving** (Android only). `https://<pc>.ts.net/apk/`, served by the
  frontend's Caddy from a persistent folder (`devops/data/apk/`, mounted read-only, so it survives
  frontend rebuilds — no new port). `/apk` redirects to `/apk/`; the page and `latest.json` are
  never cached; `.apk` files get Android's installer content type. Where nothing is mounted (the
  cloud deployment, same Caddyfile) the paths 404. Download-page mockups D1 / D2 in
  `mockups.html`.
  *Check:* each route answers as above against the running stack (test files, since removed).
- [x] **2.21b APK registry: publishing + page** (Android only). `node devops/android/apk.js publish`
  (one cross-platform Node script with `build`; it replaced the `.sh` scripts) copies the APK into `devops/data/apk/` and rewrites
  `latest.json` (`{ version, versionCode, url, sha256, notes, publishedAt }`) and a plain download
  page listing every version, newest first, with their notes, in the chosen mockup layout (D1 or
  D2 — **pick first**).
  *Check:* the page opens on the phone, downloads the newest APK and installs it; an older one is
  still listed.
- [ ] **2.21c Play Protect: stop the "unknown developer" block** (Android only). Installing or
  updating from the registry page, Google Play Protect blocks the APK ("blocked to protect your
  device — Play Protect doesn't recognise this developer"); only More details → Install anyway gets
  past it. (adb installs don't trigger it, which is why 2.20 never saw it.) Register through
  Android developer verification: a limited distribution account (personal, free, up to 20
  devices) in the Android Developer Console, the package `com.lidor.personalcopilot` with the
  release key's SHA-256 (`8D:94:1D:…:CB:50:C9`), and each phone added on the Devices page. (The
  Play Protect appeal form doesn't apply — Google says appeals don't remove the unknown-developer
  prompt.) Until then the page's hint tells users how to get past the warning.
  **Status (2026-10-09): registered and verified, phone added — still blocked.** A fresh install of
  0.1.1 from `/apk/` right after verification still showed "blocked… Play Protect hasn't seen apps
  from this developer". Possibly propagation delay. **Recheck on or after 2026-10-11** with the
  next APK version as an update from `/apk/`; if still blocked, Play Protect's warning may not
  follow the registration until global enforcement (2027) — keep the page's hint.
  *Check:* a fresh install of the newest APK from `/apk/` on a phone with Play Protect on shows
  no block.
- [x] **2.22 In-app update prompt** (Android only). On start and when the app comes back to the
  foreground, the APK fetches `/apk/latest.json`; if its `versionCode` is newer than the installed
  one (computed from the frontend version baked into the build, `src/utils/versionCode.js` — no native module), a prompt: "Version 1.3.0 is available · What's new · Update / Later".
  Update downloads the APK inside the app, into its cache (never Downloads; the new version deletes
  it on first start), with progress and Cancel, then opens Android's install screen (the first time
  it asks to allow installs from Personal Copilot) — mockups U2a–c. "Later" doesn't reopen the sheet for that version. The web build — and so the
  iPhone's Home Screen app — never shows it (it's always the newest). Only release versions are
  offered; `-test.N` builds are installed by hand from the registry page. **New UI → mockup first**
  (chosen: **U2** bottom sheet + **K1** chip in `mockups.html`). The sheet opens by itself once per
  version; after Later, a small "↑ 0.2.0" chip next to Home's Live chip stays until the update is
  installed, and tapping it reopens the sheet — no login needed.
  *Check:* install 0.4.0, publish 0.4.1 — the prompt shows; Update installs over it keeping the
  login; 0.4.1 shows no prompt.
  *Done 2026-10-09:* 0.2.0-test.1 → no prompt; 0.2.0 published → sheet + chip; Update (browser) installed
  0.2.0; 0.2.1 published → in-app download installed it, nothing in Downloads. Not yet seen: the
  progress bar/Cancel on a slow connection, and login kept (the phone was signed out).
- [x] **2.22b Gateway pushes app updates over WebSocket** (Android only for the sheet). The app
  always connects to Gateway's `/ws`, signed in or not, with its **device token** — a signed,
  anonymous identity per install from `POST /realtime/device` (strict rate limit), kept for good;
  plus its login token once signed in. Without a login token the connection is anonymous: it only
  receives broadcasts. One connection per device — a newer one (a network switch, another tab)
  closes the old at once; how many one client can hold is bounded by the device-token rate limit.
  `apk.js publish` announces a new newest release on Kafka (`frontend.releases`, compacted; the
  script runs the producer inside the `kafka` container, whose port stays unpublished), and
  Gateway broadcasts `app-update` (empty payload); the app answers with the same `checkForUpdate`
  as on start, so `latest.json` stays the only source of truth. No `app` version any more — the
  frontend's own version is the release. Start and return-to-foreground checks stay — a closed app
  has no socket. Home's Live chip is gone; the update chip took its place.
  Also fixed the real client IP (found here): Gateway's port is published on `127.0.0.1` only and
  `src/trust-proxy.ts`'s `TRUST_PROXY` (loopback + private networks) is Express's `trust proxy`,
  so the rate limits key on each client.
  *Tests:* device token issued and rate-limited; four kinds of bad device token and a bad login
  token refused; anonymous gets broadcasts but no user pushes; a push reaches every device of the
  user; the same device's new connection replaces the old; the release consumer broadcasts.
  *Done 2026-10-09:* the tailnet IP's port 8000 refuses connections; a published release reached an
  open connection over Kafka → `/ws` in 1.3 s; the phone (0.4.0-test.2) holds one connection while
  open and none in the background. Not yet watched: the sheet opening on the phone right after a
  publish — next release (0.4.0).
- [x] **2.22c Docs drift check** (tooling). `node scripts/docs-check.js` checks the docs against
  the code — every path a doc names exists; each backend app's env vars ↔ its `environment.md` ↔
  `backend/.env.example`; what `devops/.env` feeds ↔ its `.env.example` and docs; Kafka topics, queues, Caddy's `@gateway` routes, services and version
  components agree; no plan references outside `docs/plans/` — and exits 1 on drift. `--changed`
  first lists the docs the uncommitted changes should update (`DOCS_MAP`). The docs agent runs it
  at the end of every task; a task isn't done while it fails.
  *Tests:* `node --test scripts/` — a passing and a failing fixture per check, the `--changed`
  mapping, CRLF and non-ASCII paths.
  *Done 2026-10-09:* its first run found and fixed `reminder-due` filed under Kafka in
  `event-schemas.md`, env vars missing from the four `environment.md` pages, and stale paths in
  the agent guides.
- [ ] **2.23 Firebase project + keys** (Android only). *You:* create a free Firebase project
  (Analytics off), add an Android app with the APK's package name, download its
  `google-services.json`, and create a service-account key for sending. *Then:* `google-services.json`
  lives in `devops/data/android/` next to the signing key (outside git); `apk.js build` copies it
  in and `app.config.js` sets `android.googleServicesFile` only when it's there. The service-account
  key goes in `backend/.env` as `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` — read only
  by the Notification Service, placeholders in `backend/.env.example`. Nothing is exposed: sending is
  an outbound call to `fcm.googleapis.com`.
  *Check:* the Notification Service gets an access token from the key, and a `validate_only` send
  to a made-up device token is refused as an invalid token, not as unauthorized.
- [ ] **2.23b Prove encrypted delivery** (Android only, a throwaway test). A test build of the APK
  with `expo-notifications` + a background task that decrypts an AES-256-GCM data-only message with
  a key stored on the phone and shows it as a notification; a host script sends one such message
  through FCM with the service-account key. *Check, on the phone:* it shows within seconds with
  the app open, in the background, **swiped away**, and with the phone locked and idle for a
  while (Doze). **Decision after it** (record it here): every case works → 2.24/2.25 as written
  (encrypted). Any case fails → the fallback below. The test code is removed afterwards; what's
  kept is rebuilt properly in 2.24/2.25.
  *Fallback, if needed:* FCM shows a plain **"You have a new notification"** by itself (a
  notification message, no app code runs, so it always arrives). The real text never goes to
  Google: the Notification Service keeps it (a `pending_notifications` row per user, deleted after
  `expiresAt`), and the app reads it over its `/ws` connection when opened (from the tap or on its
  own) — Gateway pushes the user's pending ones on connect — and shows it in the app. Then 2.24
  stores no device key and sends the plain message; 2.25 drops the background task.
- [ ] **2.24 Notification Service: FCM channel.** `fcm_devices` table (`user_id` → `users.users`
  `ON DELETE CASCADE`, the FCM `token` (unique), the device's 256-bit `key`, timestamps).
  `PUT /notifications/fcm-devices` `{ token, key }` (JWT, through Gateway) adds or updates a
  device; `DELETE` with `{ token }` removes it, so a turned-off phone stops at once. `FcmChannel
  implements INotificationChannel` (channel `'fcm'` in `queue-contracts`): for each of the user's
  devices, a high-priority **data-only** message whose payload is `{ title, body, notificationId,
  expiresAt }` encrypted with that device's key (AES-256-GCM), Android TTL = whole seconds left;
  per-device progress (`fcm:<deviceId>`) and retries like `WebPushChannel` — unregistered token →
  row deleted and marked done; 429/5xx/network → `RetryableDeliveryException`; anything else →
  permanent. Reminders doesn't change (it already omits `channels`, meaning every channel the user
  has). Neither tokens nor keys are ever logged.
  *Tests:* the message goes to each device with only ciphertext in it, decryptable with that
  device's key alone; unregistered → deleted; retry skips done devices; a deleted account's devices
  go. *Check:* a hand-enqueued `notification-requested` reaches the phone (with 2.25).
- [ ] **2.25 APK: turn on notifications (FCM)** (Android only). `expo-notifications` (+
  `expo-task-manager` for data messages). On the APK, the Notifications card and the after-login
  prompt: "Turn on" asks Android's notification permission (Android 13+), generates the device
  key (kept in secure storage), gets the FCM token and calls `PUT /notifications/fcm-devices`. A
  background task receives each message, decrypts it and shows it as a local notification (one per
  `notificationId`; tapping opens the app). A changed FCM token is re-sent; off, Log Out and
  Delete account → `DELETE` (an expired session doesn't, like Web Push). **Changed UI → update
  the 2.14 mockup first.** Replace the APK's "coming soon" stopgaps from 2.20 with the real
  states (on / off / permission denied): `SUBTITLES.unsupported`'s non-web branch in
  `NotificationsCard.js`, and the `Platform.OS !== 'web'` message in `CandleReminder.js`'s
  `NotificationsNudge` (whose "Turn on" link must then work on the APK too). Neither may say
  "coming soon" after this task. (Shaped by 2.23b's decision.)
  *Check:* a reminder fired by hand arrives with the phone locked and our app swiped away; tapping
  it opens the app; turned off, nothing arrives. (Add the test helper used for 2.16 to the repo as
  a Node script: makes a user's real reminder fire in N minutes.)
- [ ] **2.26 Installable web app (PWA) + iPhone support.** A web manifest
  (`manifest.webmanifest`: name, short name, `display: standalone`, `start_url`/`scope` `/`, theme
  and background colors from the palette) and the app icon from 2.20b in every size the platforms
  need (192/512 px, a maskable version, Apple's 180 px `apple-touch-icon`, favicon), linked from
  the web build's HTML. Android Chrome then offers "Install app"; iPhone Safari "Add to Home Screen".
  On an iPhone in Safari (not yet on the Home Screen), the after-login notifications prompt and
  the Account card don't offer "Turn on" (Safari can't do push there) but explain: "To get
  reminders on iPhone, add this app to your Home Screen: Share → Add to Home Screen, then open it
  from there". Opened from the Home Screen (standalone), the normal Web Push flow from 2.14 works
  (iOS asks permission only from a tap, which "Turn on" is). **The iPhone hint is new UI → HTML
  mockup first** (the icon itself is already designed in 2.20b).
  *Check:* on an iPhone (iOS 16.4+): the hint shows in Safari; added to the Home Screen it opens
  full screen with the icon, "Turn on" asks permission, and a reminder fired by hand arrives with
  the phone locked. On Android, Chrome offers to install it and it opens full screen.
- [ ] **2.27 End-to-end on the phones + docs sync.** Android: install the APK from the registry,
  update it once through the in-app prompt, receive a real reminder through FCM with the phone
  locked. iPhone: the Home Screen web app receives a real reminder through Web Push. Admin: see
  every service up (and one stopped as down) on the Admin tab. Docs: `CLAUDE.md` (it says
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

- **Release key backup:** where do you want the APK signing key backed up? Losing it means
  uninstalling the app (and signing in again) to install any newer version.
- **Holiday eves for the reminder** (task 3.4): yes or no?
- **Location denied:** is the "Location is off" message enough, or do you want a manual city
  picker as a fallback?
