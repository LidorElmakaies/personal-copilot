# Plan: Android only, reminders on the phone

Branch: `feature/shabbat-and-calendar` (or a new one — the user decides).
Asked 2026-10-21. Replaces the server-side reminders and the web app; the earlier plan,
[`../shabbat-reminders-calendar/plan.md`](../shabbat-reminders-calendar/plan.md), stops where it
is — see "What's left from the Shabbat & calendar plan" at the end of this file.

## How we work through this plan

Same rules as the Shabbat & calendar plan:

- One task at a time. After each task: stop, summarize what changed and how to check it, and wait.
- Move to the next task, or the next stage, **only when the user says so explicitly**.
- Tick a task's box when it's done. **Never stage or commit** — leave changes unstaged for review.
- If a task turns out bigger than expected, split it here first.
- After each change, ask which components to bump (CLAUDE.md "Versions"); deleted components leave
  `version/versions.json` in task R5.
- **Nothing is deleted before stage R1 proves the phone can do the job** (calendar maths and exact
  local notifications on the real phone).

## Goal

- **Android app (APK) only.** No web export, no Chrome/browser support, no Web Push, no PWA, no
  iPhone web app.
- **Reminders live on the phone** — the Shabbat candle-lighting reminder, the user's own reminders,
  and (later) holiday reminders — stored locally and fired as **local Android notifications**. No
  login needed for any of it.
- **The auth work stays in the repo, dormant:** Gateway, the Users Service, `auth-kernel`, the
  login/register screens and the Account tab (hidden, not deleted). Not started by default, not
  called by the app.
- Later, its own stage: **the app feels more "floating"** (see R8).

## Decisions

Decided (2026-10-21):

- Android only; reminders on the phone with local notifications; no users needed for reminders.
- Gateway, Users Service, auth code: **kept, dormant**. Account tab: **hidden**, not deleted.

Proposed — **the user still has to confirm these** (recommendation first):

1. **Calendar maths on the phone.** Move `@app/jewish-calendar` (≈790 lines of pure TypeScript
   over `@hebcal/core`, 79 tests) to a shared `packages/jewish-calendar` that the app imports (and
   dormant Gateway can still import). The app then needs no server at all. This reverses the old
   "all calendar calculation is on the server" decision — that was about keeping the rules in one
   codebase, and they still are. *Alternative:* keep Gateway serving `/calendar/*` (the PC must be
   reachable for every calendar view).
2. **App updates: a small `/apk/`-only Caddy** at today's address (`https://<pc>.ts.net/apk/`).
   Installed APKs read `latest.json` there; a different address strands every phone already out
   there. *Alternatives:* `tailscale serve` of the folder (MIME type / no-cache headers unverified),
   or an external host (changes the address).
3. **Kafka goes entirely**, and the Users Service loses its outbox (`user-events.ts`, the outbox
   relay, `outbox_events`). Nothing reads `users.user-state` or `frontend.releases` any more.
   *Alternative:* keep Kafka for dormant Users (smaller diff, but the outbox grows with nothing
   draining it).
4. **Theme switch** gets a new home now the Account tab is hidden — e.g. a small icon on Home.
5. **Existing reminders on the server** (the user's candle-lighting offset and custom reminders):
   recreated by hand on the phone, or a one-time export. Default: by hand (few reminders).
6. **"More floating"** — what it means (smoother motion, floating/glassy look, or both) is open;
   it's stage R8, mockup first.

## Inventory (from the backend, frontend, devops, testing and docs agents, 2026-10-21)

### Goes entirely

- **Backend:** `apps/notifications/` (Web Push, FCM, ≈3.9k lines), `apps/reminders/` (≈4.6k),
  `libs/queue-client`, `libs/queue-contracts`, `libs/users-schema`, Gateway `src/realtime/` and
  `src/app-update/`, `DeviceTokenService` in `auth-kernel`; if Kafka goes, `libs/kafka-client` and
  `libs/kafka-contracts`. Packages: `web-push`, `http_ece`, `bullmq`, `ioredis`, `socket.io`,
  `@nestjs/websockets`, `@nestjs/platform-socket.io`, `kafkajs`.
- **Gateway wiring to the removed services:** the `/reminders*` and `/notifications/*` rows of
  `PROXY_ROUTES` (and `proxy.api.spec.ts`'s contract rows), `PROBED_SERVICES` entries, the
  `/realtime/device` throttle, `REMINDERS_`/`NOTIFICATIONS_SERVICE_URL`.
- **Frontend:** `public/` (`sw.js`, manifest, `index.html`, icons), the web `Dockerfile`,
  `build:web`/`web` scripts and `app.json`'s `web` block, `pushService.js`, the FCM services
  (`fcmService*`, `fcmReceiver*` — keep the channel setup and `setNotificationHandler` for R3),
  `services/ws/`, `wsSlice`, `realtimeService`, `notificationsService`, `RealtimeConnectionManager`,
  `LocationSyncManager`'s server half, `appUpdateSlice`'s socket listener, the web halves of
  `Stars`/`Meteors` (`CssStar`, `CssMeteor`), `TabPager`'s web `scrollLeft` fix, `GlowCard`'s blur
  branch. Packages: `react-native-web`, `react-dom`, `socket.io-client`, `@noble/ciphers`,
  `expo-crypto`, `expo-secure-store` (FCM only — check), `expo-blur` (check `GradientButton`).
- **Devops:** `devops/{reminders,notifications,redis,kafka}/`, `devops/frontend/` (web + the
  Hetzner/Caddy/SSH-tunnel cloud path, `.env.cloud.example`, `caddy-data`), `devops/playwright/`
  (**keep its pinned image tag for `devops/icons/render.js`**), the `reminders`/`notifications`
  schemas in `postgres-init`, `REDIS_URL`/`KAFKA_BROKERS`, `VAPID_*`, `FCM_*`,
  `google-services.json` (and its `secrets.js` entry, `app.config.js`'s `googleServicesFile`),
  `scripts/fire-reminder.js`, `apk.js`'s Kafka `announce`/`releaseEvent` step.
- **Tests (≈35 files, ≈265 tests):** everything under the two deleted apps and four deleted libs,
  Gateway `realtime.api` and the release consumer, and all of `frontend/e2e/` (Playwright drives
  the web export). **Before deleting, keep their scenarios as the spec for the new tests** — the
  two scheduler specs (`reminder-scheduler`, `custom-reminder-scheduler`, 59 tests) and the
  Playwright flow specs (`calendar`, `custom-reminder*`, `reminders`, `busy-day`, `tab-swipe`,
  `shabbat`, `home`).
- **Docs:** `docs/specs/notification-flow.md`, `event-schemas.md` (all of it once Kafka goes),
  `docs/reminders/`, `docs/notifications/`, the matching sections of `services.md`,
  `architecture.md` (SSH tunnel, server reminder flows), `frontend/README.md` (web app, Web Push,
  Caddy deployment).

### Dormant (kept, not started by default, still tested)

- **Backend:** Gateway (auth + profile proxy rows, admin with only `users` probed, calendar module
  while it's useful), `apps/users`, `libs/auth-kernel`, `libs/otel`, `libs/build-info`. Their tests
  stay in `npm test`.
- **Devops:** `gateway`, `users`, `postgres`, `postgres-init` behind `profiles: ["backend"]` —
  `docker compose up` skips them, `docker compose --profile backend up -d --build` starts them.
  Observability started only with them; the app stack's network stops requiring it.
  `devops/data/postgres/` (the existing accounts) stays.
- **Frontend:** `app/(auth)/*`, `account.js`, `admin.js`, their components (`AccountCard`,
  `ProfileCard`, `LogoutCard`, `DeleteAccountCard`, `SystemStatus`, …), `authSlice`,
  `profileSlice`, `adminSlice`, the http services, `useRequireAuth`, `useHasRole`.

### Needed / changes

- **Calendar lib → the phone** (decision 1): the one `@nestjs/common` import
  (`UnprocessableEntityException` in `shabbat-calendar.ts`) becomes a plain error; the
  `@hebcal/core/dist/esm/index` import path; `temporal-polyfill` (1.1 MB, needs BigInt); `Intl`
  `timeZone` + `formatToParts` in `civil-date.ts` on Hermes.
- **Reminder rules → the phone:** candle lighting − offset (`reminder-scheduler.service.ts`), next
  occurrence and skipped dates (`custom-reminder-scheduler.service.ts`, `reminder-occurrences.ts`),
  validation (`custom-reminder.service.ts`, `custom-reminder.dto.ts`).
- **APK build, signing and updates:** `devops/android/` (`apk.js`, Dockerfile, `apk.test.js`), the
  release keystore and `keystore.properties` (**never touch** — without them no APK can update the
  installed app), `devops/data/apk/`, `version.js`, `secrets.js` (minus FCM/VAPID),
  `devops/icons/render.js`.

## Stage R1: prove the phone can do it (nothing deleted)

- [x] **R1.1 Calendar lib on the phone (spike).** A throwaway screen or script in the APK that runs
  `@app/jewish-calendar` (Shabbat times + a month) for a Tel Aviv point and compares with
  `/calendar/month`. Checks: Metro resolves `@hebcal/core`, `temporal-polyfill` runs on Hermes,
  `Intl` with `timeZone: 'Asia/Jerusalem'` + `formatToParts`, and how much the APK grows.
  *Check:* same times as the server on the S23, APK size before/after noted here.
  *Done 2026-10-21 (S23 Ultra, APK 0.6.0-test.6, Hermes):* all 9 checks pass — Shabbat times and
  the months 2026-12 and 2027-10, Tel Aviv and Jerusalem, identical to Gateway's answers; BigInt and
  `Intl` `timeZone`/`formatToParts` work. 2–11 ms per calculation, 52 ms in all including loading
  the lib. APK 46,428,070 → 46,790,698 bytes (+362 KB, including the spike's 57 KB of expected
  answers). The lib needed two edits: the `@nestjs/common` error became a plain `Error`, and the
  import is plain `@hebcal/core` (Metro picks its ESM build; the `dist/esm/index` path was a
  CommonJS workaround for Node only). `@hebcal/core` 6.9.3 added to `frontend/package.json` (same as
  the backend). Note: `@hebcal/core` installs a global `Temporal` polyfill when it loads.
  Spike files to remove (in R2): `frontend/app/spike.js`, `frontend/src/spike/` (the lib copy,
  `runChecks.ts`, `nodeCheck.mjs`, `expected.json`); opened with `personalcopilot://spike`.
  The first Docker build failed in `expo-modules-core`'s native step ("build.ninja still dirty",
  Docker's clock was 23 s behind the PC's); the retry built fine.
- [ ] **R1.2 Local exact notifications (spike).** `expo-notifications` date-triggered
  notifications, `USE_EXACT_ALARM` in `app.json`. *Check on the phone:* one fires on the minute
  with the app swiped away and the screen off; it survives a reboot; it survives an APK update
  (`MY_PACKAGE_REPLACED`); note the pending-alarm limit. Never change the phone's settings without
  asking (memory: phone adb settings).
- [ ] **R1.3 Decide.** Record the results here and settle decisions 1–3 (and the background top-up
  question in R3.3) before R2.

## Stage R2: calendar maths on the phone

- [ ] **R2.1 `packages/jewish-calendar`.** Move the lib (source, specs, README) to a shared package;
  no Nest dependency; Gateway's calendar module imports it from there.
- [ ] **R2.2 Jest in `frontend/`.** `jest-expo` + React Native Testing Library, `npm test` as the
  one command (the same ESM transform for `@hebcal/*` the backend uses); the lib's 79 tests run
  there, the Israel-time cases kept as they are.
- [ ] **R2.3 The app computes locally.** `services/http/calendarService.js` → a local module with
  the same shapes (`/calendar/shabbat` and `/calendar/month`); `calendarSlice` and its month cache
  unchanged. *Check:* Home and the Calendar tab work in airplane mode.

## Stage R3: reminders on the phone

- [ ] **R3.1 Local store.** Persisted, whitelisted state for the candle-lighting reminder
  (`{ enabled, offsetMinutes }`) and the custom reminders (definitions: title, time, repeat,
  calendar, anchor, skipped dates). `customRemindersSlice` keeps its shape for the calendar
  (`dayReminders` from the definitions over the loaded months); the server race handling
  (`changeSeq`, list retries, sign-out drop) goes.
- [ ] **R3.2 Local scheduler.** `services/device/localNotificationsService.js` over
  `scheduleNotificationAsync` / `cancelScheduledNotificationAsync`, and one reconcile thunk: for
  each reminder, its next N firings (a rolling window; total capped, e.g. 100), deterministic ids,
  cancel what's no longer due. Runs on save/delete, app start, return to the foreground, a > 5 km
  location move (the old `LocationSyncManager` trigger, no server call), and the first start after
  an update. Notification texts as today ("Shabbat candle lighting" / "Candle lighting is at 17:34
  (in 1 h 30 min)."; a custom reminder's title / "Your reminder for …").
- [ ] **R3.3 Background top-up.** If the app isn't opened for weeks the window runs out:
  a periodic background task (`expo-background-task` / WorkManager) re-runs the reconcile —
  or accept the gap. Decide after R1.2.
- [ ] **R3.4 UI without login.** `CandleReminder`, the Calendar's +, `CustomReminderSheet`: no
  `accessToken` gating, no "Log in to …" prompts. `notificationsSlice` shrinks to the permission,
  the `reminders` channel, "Not now" and Open settings; the N1 prompt shows to everyone.
- [ ] **R3.5 Tests.** The two server scheduler specs' scenarios ported to the local scheduler
  (next firing, after firing, skipped day, edit, delete, Israel time, location move), plus slice and
  component tests. *Check on the phone:* all six custom kinds and the candle-lighting reminder fire
  with the app closed and the screen off (as 3.6f did).

## Stage R4: hide what's dormant in the app

- [ ] **R4.1 Tabs.** `hidden: true` on Account and Admin in `app/(tabs)/_layout.js`, filtered into
  `visibleTabs` (so swipes can't reach them); route files kept. Theme switch moved (decision 4).
- [ ] **R4.2 Root layout.** `AuthGate` (token renewal), `RealtimeConnectionManager`,
  `PushSubscriptionManager`'s server half out of `app/_layout.js`; `src/config/urls.js` no longer
  throws without `EXPO_PUBLIC_GATEWAY_ORIGIN`; `apk.js build` no longer requires an HTTPS Gateway
  URL.

## Stage R5: delete what goes

- [ ] **R5.1 Backend.** The two apps, the libs, Gateway's realtime/app-update modules and their
  rows, Kafka + the Users outbox (decision 3), packages, `nest-cli.json`, `tsconfig.json` paths,
  `jest.config.js`. Dormant Gateway and Users still build and pass `npm test`.
- [ ] **R5.2 Frontend.** Web build, FCM, socket, push services, web-only branches, `e2e/`,
  packages. `version/versions.json`: `reminders` and `notifications` removed (`scripts/version.js`
  and its tests if it lists them).
- [ ] **R5.3 Opt-in phone smoke tests.** Maestro flows over adb (launch, Shabbat times shown, add a
  reminder, the notification appears) — optional release check, never changing phone settings.

## Stage R6: devops

- [ ] **R6.1 Compose.** Remove the dead services; `profiles: ["backend"]` for the dormant ones;
  observability only with them.
- [ ] **R6.2 `/apk/` server** (decision 2) at the same address; `devops/tailscale/serve.js`
  updated; `tailscale serve` live config reset to match. *Check:* the installed APK still finds an
  update.
- [ ] **R6.3 Secrets.** `secrets.js` `FILES` and both `.env.example`s without VAPID/FCM/Redis/Kafka;
  re-push the encrypted bundle (Windows and Ubuntu PCs).

## Stage R7: docs

- [ ] **R7.1** `CLAUDE.md` (what this is, layout, what's implemented, first run, commands,
  versions, key constraints, architecture), `docs/specs/*`, environment docs, READMEs.
- [ ] **R7.2** `.claude/agents/*.md` (devops and backend shrink; frontend and testing switch from
  browser checks to device/Jest), `.claude/memory/` (`project_personal-copilot.md`,
  `feedback_gateway_only_service_access.md`).
- [ ] **R7.3** `scripts/docs-check.js`: drop `checkCaddy`, `checkQueues`, `checkTopics` (and their
  fixtures in `docs-check.test.js`), `DOCS_MAP` rows for `frontend/public|Caddyfile` and `e2e/`, a
  row for the new on-phone code; delete orphaned `docs/reminders|notifications/environment.md` by
  hand (`checkEnv` won't flag them).
- [ ] **R7.4** Mark the old plan's reversed decisions (see below) as superseded by this plan.

## Stage R8: more "floating" (after R1–R7)

- [ ] **R8.1 Mockup first** (meaning to be agreed — decision 6). Candidates the frontend agent
  found: spring / flick-velocity settling in `SwipePager` and `TabPager` (linear `withTiming`
  today), a floating pill tab bar instead of the static one, press animations on `GradientButton`
  and `PillButton` (none today), real blur on Android cards (`GlowCard` is opaque there).
  The current look is already a known stepping-stone (CLAUDE.md).
- [ ] **R8.2 Build** the chosen variant.

## What's left from the Shabbat & calendar plan

[`../shabbat-reminders-calendar/plan.md`](../shabbat-reminders-calendar/plan.md) is done up to
3.7, except:

- **3.4 Holiday reminders — moves here, after R3** (needs local reminders). The product decisions
  from 2026-10-21 stay as they are: one switch per holiday; Pesach's and Sukkot's first and last
  days separate; each holiday its own offset, set in the Shabbat reminder's sheet; a Yom Tov on
  Shabbat sends both; one reminder per holiday at its start − the offset (candle lighting for Yom
  Tov and Yom Kippur, Chanukah's candle lighting, sunset the evening before for Purim, Rosh Chodesh
  and dawn fasts); no fast-end notification. What changes:
  - **3.4a Mockup** — not started (stopped 2026-10-21 for this refactor). Drop the signed-out
    "Log in" prompt from its list.
  - **3.4b Rules** — in `packages/jewish-calendar`, not the backend lib.
  - **3.4c** — no Reminders Service: on holidays stored on the phone (keys from 3.4b), scheduled by
    R3's reconcile.
  - **3.4d Frontend** — no `GET /reminders/holidays`, no sign-in; e2e becomes Jest + the phone.
  - **3.4e** — on the phone; docs list per R7.
  - Open points found while starting 3.4a (still to decide in the mockup): Rosh Chodesh as one
    switch for every month or one per month; Chanukah's time on a weekday (sunset or nightfall) and
    on Friday (before the Shabbat candles); a dawn fast whose evening before is Yom Tov (Tzom
    Gedaliah 2027 — sunset falls during Rosh Hashana II); which days show a holiday's bell (all its
    days and the day named "Erev …"?).
- [ ] **3.4 Holiday reminders (moved from the old plan)** — tasks 3.4a–e as above.
- **3.5 Docs sync** — becomes R7.
- **2.21c Play Protect** — still open, unaffected (Android only). Kept in the old plan.
- **2.26a PWA** and **4.1 iPhone** — dropped (no web, no iPhone).
- **Old plan decisions reversed by this one:** all calendar calculation on the server; reminders
  per user (login required); Reminders → BullMQ → Notifications; Web Push / FCM; Kafka for events,
  BullMQ for jobs; one database with reminders/notifications schemas; deleting an account cascades
  into them; location follows the phone (server sync); no server → open app channel; phones:
  iPhone gets the Home Screen web app; ready to move to the cloud (moot while the backend is
  dormant).
- **Open question "Holiday eves for the reminder"** — answered by 3.4's 2026-10-21 decision.
- **`open-issues.md`:** "Notifications: contract and validation", "rare delivery cases", the
  `upsert(['endpoint'])` test item, "Redis overcommit warning", the Redis `dump.rdb` leftover, the
  device list idea and the red "Disconnected" chip all go with the deleted code. Still relevant:
  Postgres receiving the backend secrets (dormant stack), the `testing.md` testcontainers claim, the
  `tsc` errors in `shabbat-calendar.spec.ts` (fix when the lib moves in R2.1), refreshing Shabbat
  times when the app returns to the foreground.
