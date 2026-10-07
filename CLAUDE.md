# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this project is

**personal-copilot**: a NestJS + Expo app — Gateway, a Postgres-backed Users Service (login + profiles), a Reminders
Service (candle-lighting reminders), a Notification Service (Web Push), full OTel observability, and a frontend with optional login. The first feature is being
built in stages from [`docs/plans/shabbat-reminders-calendar/plan.md`](docs/plans/shabbat-reminders-calendar/plan.md)
(Shabbat times on Home → per-user candle-lighting reminders → a Jewish-calendar tab); read that
plan and its design pages (`architecture.html`, `mockups.html`) before working on the feature.
Stage 1 (Shabbat times) and stage 2's candle-lighting reminder (checked end to end on the phone)
are done; stage 2's second part (versions, admin status, Android app + ntfy) is in progress —
admin sign-in, versions and admin status are done, the Android APK (2.20) is next; stage 3 (the Calendar tab) follows. Work the plan one task at a time and stop for review after each.

Hosted on the user's personal PC, reachable from their phone via **Tailscale** — `gateway` is the
only backend service published to the host (`frontend` also has its own published port — it's a
static web export, not a backend service, see "Key constraints" below). `tailscale serve`
(`devops/tailscale/serve.sh`) puts both behind HTTPS on the PC's `*.ts.net` name, which phone
browsers require for GPS. A second, optional
deployment path also exists in code (not yet live infra): `frontend` built and run standalone on a
Hetzner VPS behind Caddy, reaching `gateway` back on the home machine over an SSH reverse tunnel —
see `docs/specs/architecture.md`'s "System topology" and "SSH reverse-tunnel hardening" sections.
Tailscale remains the primary access path either way.

**Deliberately bootstrapped to match a sibling project's conventions** — `ask-my-crawl`, a separate
repo not checked out on this machine — same NestJS Nest-CLI monorepo shape, same clean/hexagonal layering, same
Gateway/auth-service split (here the Users Service) with a shared `auth-kernel` lib, same `devops/<service>/docker-
compose.yml` structure, same `.claude/agents`/`.claude/memory` setup, and — as of this rewrite —
the same frontend theme/component conventions (see the Architecture section's Frontend paragraph).
Deliberately simpler where this project's actual shape allows it: no admin features yet (`UserRole` is
`'user' | 'admin'`; the only admin is a one-time seeded account that signs in and uses the app like
any user, plus an admin-only Admin tab of service status (`AdminGuard` on `GET /admin/status`) — see `docs/specs/services.md#users`), no Gluestack dependency on the frontend (the animated theme pipeline is
ported, the unused Gluestack layer underneath it isn't — see `frontend/README.md`). The current
look (space/glow/gradient) is a known stepping-stone, not a final design — expect it to be replaced
by a different, more animated style later.

Five agent personas exist for working this repo:
`.claude/agents/{backend,devops,frontend,testing,docs}.md`. `docs` is the one to hand off to when a
change is otherwise done — it keeps `docs/specs/`, `CLAUDE.md`, the READMEs, and this file's own
siblings in sync with current reality, and trims comments that have grown past a line. See its own
file for what it does and doesn't own.

## Git rule (non-negotiable)

**Never run `git add` or `git commit` (or anything else that stages or commits) unless the user
explicitly says so** — e.g. "stage this", "commit this". Finishing a task, ticking a plan box, or
"ok, go ahead" is not permission. Leave changes unstaged so the user reviews the diff. Applies to
every agent in `.claude/agents/` too. Also in [README.md](README.md).

## Versions (ask before bumping)

Every version lives in [`version/versions.json`](version/versions.json): `app` (the whole project,
grows with every change) and one per deployable component (`frontend`, `gateway`, `users`,
`reminders`, `notifications`). Semver `MAJOR.MINOR.PATCH`: major = breaks or changes how the app
works, minor = a feature or an important API/route change, patch = a small fix; bumping one part
resets the parts to its right. Test builds while fixing are `-test.N` (`1.3.0-test.1`, `-test.2`, …);
the release drops it (`1.3.0`). Bump only with `scripts/version.sh` — it applies those rules and
bumps `app` the same way; it never touches git (it prints the tag to add after the commit).

**After every change, ask the user which components to bump and how, with a suggestion** (e.g.
"Gateway: minor (new route), frontend: patch — app → minor?"). Never bump without the answer.
A change to a shared `backend/libs/` library bumps each service that uses it. Changes to docs,
plans, tests or agent files only don't bump anything; a `devops/` change that alters how a service
runs is a patch for that service. Each backend image bakes in only its own version and its build
time, reported on its internal `/health` (Users, Reminders, Notifications; Gateway has no `/health`
and its public routes never expose versions); the frontend image bakes in the app and frontend
versions and shows them on the Account tab. Applies to every agent in `.claude/agents/` too.

## Repo layout

```
backend/                 NestJS monorepo — apps/{gateway,users,reminders,notifications}
                          + libs/{auth-kernel,otel,queue-client,queue-contracts,
                          kafka-client,kafka-contracts,users-schema,
                          jewish-calendar,build-info}
frontend/                 Expo/React Native app — login/register (optional, not gated app-wide), a
                          Home tab (clock + Shabbat times + candle-lighting reminder), and an
                          auth-gated Account tab;
                          public/sw.js is the Web Push service worker;
                          e2e/ holds the containerized Playwright tests
devops/                   docker-compose.yml (app stack: services + shared postgres/redis)
                          + android/ (the APK builder image + build-apk.sh)
                          + observability/ (Grafana/Loki/Prometheus/Tempo/OTel, joined to
                          the app stack via a shared Docker network)
docs/specs/               services.md, event-schemas.md (queues/jobs), notification-flow.md,
                          architecture.md (Mermaid diagrams) —
                          source of truth for how it's wired
docs/plans/               staged feature plans + their HTML design pages
version/versions.json     every version (app + one per component) — see "Versions" above
scripts/version.sh        the only way to bump them
```

## What's implemented

- **gateway** (`backend/apps/gateway`) — HTTP + WS, the only backend service reachable from outside
  the Docker network. Rate-limited globally (`@nestjs/throttler`, `THROTTLE_TTL_MS`/
  `THROTTLE_LIMIT`, default 60s/100req) plus a tighter per-route limit on `/auth/register`,
  `/auth/login`, `/auth/refresh`, `/auth/account`
  (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`, default 60s/5req); `/auth/logout` stays on the
  global default since it needs a valid token already, as do `/calendar/*` and
  `/notifications/*`. Seven feature modules, with the proxying ones built on one shared forwarder in `src/proxy/`
  (`ServiceHttpClient`, `writeProxyResponse` — `502 <service>_unreachable` when a service is down):
  - `src/auth-proxy/` — thin pass-through to the Users Service, one hardcoded route per operation (not
    a wildcard): `register`, `login`, `refresh`, `logout`, `account` (`POST` edits, `DELETE`
    deletes the account) — no guard on any of them
    (that's how you get a token in the first place, and `account` is body-driven the same way, see
    `apps/users` below). No `/me` — the access token itself carries
    `{ sub, role, email }`, so there's nothing left for a "who am I" endpoint to return that the
    client can't already decode.
  - `src/users-proxy/` — `GET`/`PATCH /users/me`, `PUT /users/me/location` (`JwtAuthGuard`, user
    id forwarded as `X-User-Id`): the caller's own profile.
  - `src/reminders-proxy/` — `GET /reminders`, `PUT`/`DELETE /reminders/shabbat-candles`
    (`JwtAuthGuard`, same forwarding).
  - `src/notifications-proxy/` — `GET /notifications/vapid-public-key` (open),
    `POST`/`DELETE /notifications/subscriptions` (`JwtAuthGuard`; forwards the user id to
    Notifications in an `X-User-Id` header Gateway sets itself — see `docs/specs/services.md`).
  - `src/realtime/` — Socket.IO at `/ws` (token in the handshake's `auth.token`). Generic plumbing
    kept for the next feature: `IRealtimeConnectionService.pushToUser(userId, event, payload)` is
    the entry point a feature module injects to reach a user's live connection. Nothing pushes
    anything over it yet.
  - `src/admin/` — `GET /admin/status` (`AdminGuard`): Gateway's own version in-process plus each
    internal service's `/health` in parallel (timeout `ADMIN_STATUS_TIMEOUT_MS`); a service that
    doesn't answer is `down`, not an error.
- **users** (`backend/apps/users`) — HTTP, internal-only (never published to the host — stricter
  than `ask-my-crawl`'s own Auth Service, which still publishes its port as documented debt; this
  project starts without that exception). `POST /auth/register`, `/auth/login`, `/auth/refresh`,
  `/auth/logout` — none return a `user` object, just tokens. `POST /auth/account`
  (`{email, currentPassword, newEmail?, newPassword?}`, at least one of `newEmail`/`newPassword`
  required) verifies `currentPassword` the same way `login` does, applies whichever field(s) are
  present in one atomic update, and always returns a fresh `{access_token, refresh_token}` — one
  endpoint rather than two sequential calls, since an atomic single request rules out a caller
  ever authenticating a second call with an already-stale password. Body-driven rather than
  `JwtAuthGuard`-gated, deliberately consistent with this service's existing stateless pattern
  rather than introducing bearer-token auth for just this one caller. `DELETE /auth/account`
  (`{email, currentPassword}`) deletes immediately — other services' rows about the user go too,
  through `ON DELETE CASCADE` foreign keys. Profiles: `profiles` (name, phone, location, `version`,
  keyed by user id) behind `GET`/`PATCH /users/me` and `PUT /users/me/location`; register takes the
  optional details. Every profile change (and a tombstone on delete) is written to `outbox_events`
  in the same transaction and published to Kafka (`users.user-state`) by `OutboxRelay`. Postgres
  schema `users` via TypeORM (`users`, `refresh_tokens`, `profiles`, `outbox_events`),
  salt+pepper+SHA-256 password hashing (`PASSWORD_PEPPER`),
  15-min access tokens (`{ sub, role, email }` payload — the client decodes this instead of a
  separate `/me` call) + 30-day rotating refresh tokens (`backend/libs/auth-kernel` for the
  shared JWT sign/verify + guards: `JwtAuthGuard` admits any role in `USER_ROLES`, `AdminGuard`
  admins only → `403`).
- **reminders** (`backend/apps/reminders`) — internal-only, schema `reminders`. One `reminders`
  row per user and type (`shabbat_candles` so far; `user_id` → `users.users` `ON DELETE CASCADE`):
  `GET /reminders`, `PUT`/`DELETE /reminders/shabbat-candles` (user from `X-User-Id`; `PUT` takes
  only `{ offsetMinutes }`). Reads the user's location straight from `users.profiles` (read-only
  mapping) — no copy. Candle-lighting maths is the in-process `@app/jewish-calendar` lib
  (`@hebcal/core` v6; "today" is the user's date in `tz`; Israel rules and 20-min candle lighting
  when `tz` is `Asia/Jerusalem`, else 18 min — see its README for the ESM-import and time-zone
  gotchas; Jerusalem and Petach Tikva 40 / Haifa, Tzfat and Zikhron Ya'akov 30, by distance from the
  city center); there's
  no Calendar Service — Gateway serves Home's `GET /calendar/shabbat` from the same lib.
  `ReminderScheduler` keeps one delayed `reminder-due` job per enabled
  reminder at candle lighting − offset; when it runs it publishes `notification-requested` and queues next
  week's. Reschedules on save, on `users.user-state` (Kafka), after firing, and in a sweep at
  startup and every 15 min that makes Redis match the database — see
  `docs/specs/event-schemas.md#reminder-due`.
- **notifications** (`backend/apps/notifications`) — internal-only, schema `notifications`
  (`push_subscriptions.user_id` → `users.users` `ON DELETE CASCADE`) plus the BullMQ queue on Redis (`REDIS_URL`, consume-only). Stores browsers'
  Web Push subscriptions (`push_subscriptions`) and serves the VAPID public key (`VAPID_*` env, see
  `docs/notifications/environment.md`). User from Gateway's `X-User-Id` via `@app/auth-kernel`'s
  `@ForwardedUserId()`. Processes `notification-requested` jobs: drops expired ones (required
  `expiresAt`), then calls `deliver(userId, content, expiresAt, progress)` on each wanted channel
  (`INotificationChannel`), rethrowing the first error after all have run. `WebPushChannel` looks
  up the user's *current* devices on every attempt, skips those the job's progress marks done
  (`webpush:<subscriptionId>`), and sends the rest via `web-push` (`aes128gcm`, the push service
  never sees the text) with TTL = whole seconds left; each device is marked done once sent, gone
  (404/410 → row deleted) or permanently failed. Any 429/5xx/network answer → it throws
  `RetryableDeliveryException` and BullMQ retries the job, skipping done devices — a rare duplicate on
  one device is accepted. Endpoints are limited to known push-service hosts. See
  `docs/specs/services.md` and `docs/specs/notification-flow.md`.
- **frontend** (`frontend/`) — Expo Router app. Login is optional app-wide, not a gate on the whole
  app — `(tabs)` routes are freely reachable while signed out; `(auth)/{login,register}` each add a
  "Continue without logging in" link back to `/` for whoever lands there without wanting to
  authenticate; register also takes an optional first/last name (English or Hebrew letters only) and phone (country
  dropdown + local digits, validated with `libphonenumber-js`, sent as E.164). `(tabs)/index` (Home — the landing tab, no session required: live clock, today's
  Gregorian and Hebrew/Jewish date (`@hebcal/hdate`, see `frontend/README.md` for why not `Intl`),
  a live/disconnected connection chip read straight from `wsSlice.status` — always "Disconnected"
  while signed out, since the socket only opens with a token — and `ShabbatSection`: candle
  lighting, Havdalah, holiday/parasha label, and a countdown for the device's GPS location (`GET /calendar/shabbat`),
  fetched on first mount, after the GPS fix, after Havdalah passes, and on Retry; last location and
  result persisted for offline; under the times, `CandleReminder`'s bell opens a bottom sheet to
  set/change/turn off the candle-lighting reminder's offset via `GET /reminders` and
  `PUT`/`DELETE /reminders/shabbat-candles` (`remindersSlice`, not persisted, reset on sign-out) —
  signed out, the bell asks to log in instead), `(tabs)/account`
  (a heading plus `ThemeCard`, `NotificationsCard` (this browser's push on/off), `AccountCard`
  (edit email/password), `ProfileCard` (name/phone via
  `GET`/`PATCH /users/me`, fetched on mount), `LogoutCard` (`logOut`), `DeleteAccountCard` (password, then
  `DELETE /auth/account`, signs out), then `VersionInfo` (app/frontend version, build time) — each card keeps its form private, and signing out unmounts
  them all so forms reset; the one tab so far opted into `requiresAuth: true`; the shared `CustomTabBar` intercepts a press on it while
  signed out and shows `ConfirmModal` instead of navigating, but a direct hit on the route — deep
  link, web refresh — bypasses that, so the screen itself also calls `useRequireAuth()` on mount and
  renders `RequireAuthNotice` instead — both generic and reusable by any future `requiresAuth` tab,
  not Account-specific). Redux Toolkit, services-layer convention (all I/O in
  `src/services/`, split by transport — `http/`, `ws/`, and `device/` (location, browser push) — called only
  from thunks in `src/store/slices/`). Socket.IO
  auto-connects whenever `authSlice.accessToken` changes (`app/_layout.js`'s
  `RealtimeConnectionManager`) — generic plumbing, same as Gateway's `/ws`; nothing listens for a
  specific event yet. While signed in, `LocationSyncManager` (also in `app/_layout.js`) sends a
  fresh GPS fix to `PUT /users/me/location` only if it's > 5 km from the server's saved location
  or the time zone changed (`profileSlice.syncLocation`, see `docs/specs/services.md#frontend`).
  A `401` on any signed-in call (`authorizedFetch`) for the current token signs out with a notice:
  `AuthGate` takes the user to login once, which shows "Your session ended — please log in again."
  until they leave it; expiry and Log Out sign out silently.
  Notifications (web build only): `frontend/public/sw.js` shows each push (`tag` =
  `notificationId`) and opens/focuses the app on tap; `PushSubscriptionManager` (`app/_layout.js`)
  registers it at start and, while signed in, re-posts the browser's subscription to
  `POST /notifications/subscriptions`; `NotificationsPrompt` asks once over Home after sign-in.
  Logging out or deleting the account unsubscribes this browser; an expired session doesn't, so
  reminders keep arriving. See `docs/specs/services.md#frontend`.
  Themed via the three-layer pipeline described in the Architecture section
  below — `GlowCard`/`GradientButton`/`InputField`/`Alert` (`src/components/base/`, split into
  `background`/`buttons`/`feedback`/`form`/`layout` subfolders by purpose — see
  `.claude/agents/frontend.md`) and `AmbientBackground` (`src/components/composite/`) are the
  shared building blocks login/register/
  Home/Account all use; `Switch` (base/form) the toggle; `SelectField` (base/form) is the dropdown and `ProfileFields` (composite)
  the name/phone group shared by register and `ProfileCard`; `ConfirmModal` (composite) is the
  shared Yes/No overlay (the `requiresAuth` tab-press guard, `NotificationsPrompt`, the signed-out
  reminder bell); `PillButton` (base/buttons), `Stepper` (base/form) and `BottomSheet` (base/layout)
  build `CandleReminder`.
- **Queues** — BullMQ on Redis (`devops/redis/docker-compose.yml`, internal-only, AOF-persisted,
  `noeviction`, holds nothing but queues). Cross-service queues and job guards in
  `@app/queue-contracts` (`notification-requested` — Reminders publishes, Notifications
  processes; and `reminder-due`, Reminders' own delayed jobs; every publisher of `notification-requested` must enqueue with `notificationRequestedPublishOptions`
  — dedupe on `notificationId` until `expiresAt`, 8 attempts, backoff from 30 s);
  `@app/queue-client` has the publisher (dedupe/delay/attempts/backoff) and a validating consumer
  whose handler gets the job's `progress`/`saveProgress` (kept across retries). See `docs/specs/event-schemas.md`.
  Gateway's WS layer (above) is still kept-but-unused plumbing.

## First run

1. `cd devops/observability && docker compose up -d` (telemetry stack must exist first —
   `devops/docker-compose.yml` references its network as `external: true`).
2. `cd devops && cp .env.example .env` and set real random `JWT_SECRET`/`PASSWORD_PEPPER`.
   `GATEWAY_PUBLIC_URL`: `http://localhost:8000` for use on this PC only, or the HTTPS tailnet URL
   from step 4 for your phone. Also `cp backend/.env.example backend/.env` (every container reads
   it): same `JWT_SECRET`/`PASSWORD_PEPPER`, and `VAPID_*` keys from `npx web-push
   generate-vapid-keys` — without them Notifications won't boot, so Gateway (which waits for it to be healthy) won't either.
3. `docker compose up -d --build`.
4. Phone access: run `devops/tailscale/serve.sh` once (see README's "Phone access (Tailscale
   HTTPS)" for the one-time Tailscale setup), put the Gateway URL it prints into `GATEWAY_PUBLIC_URL`,
   and `docker compose up -d --build frontend`. HTTPS is required — phone browsers block GPS on
   plain HTTP.
5. Open `http://localhost:8081` on this PC, or `https://<pc>.ts.net` from your phone.

## Commands

Backend (run from `backend/`):
```bash
npm install
npx nest start gateway --watch     # or: users, reminders, notifications
npm test                           # jest.config.js — unit + API tests
REDIS_IT_URL=redis://localhost:6379 npx jest notification-flow.it queue-roundtrip  # opt-in; needs a Redis on the host
npm run lint
```

Android app (from the repo root; Docker only — see README's "Android app (APK)"):
```bash
devops/android/build-apk.sh        # → devops/data/android/apk/personal-copilot-<frontend version>.apk
```

Browser tests (from the repo root, against the running stack — see `frontend/e2e/README.md`):
```bash
docker compose -f devops/playwright/docker-compose.yml run --rm e2e
```

Frontend (run from `frontend/`):
```bash
npm install
npx expo start          # Expo Go / dev client
npx expo start --web
```

Full stack: see "First run" above — same two-command sequence (`devops/observability` before
`devops/`) every time.

## Architecture

NestJS monorepo, clean/hexagonal layering (API → Application → Infrastructure, plus a `models/`
domain layer and an `entities/` folder for TypeORM table mappings) enforced in every app — see
`.claude/agents/backend.md` before writing backend code.
Shared code lives in `backend/libs/`: `auth-kernel` (JWT sign/verify, `JwtAuthGuard`, `AdminGuard`,
`CurrentUser`), `otel` (generic OTel bootstrap, ported unmodified from `ask-my-crawl`),
`queue-client` (`IQueuePublisher`/`BullmqQueuePublisher`, `IQueueConsumer`/`BullmqQueueConsumer` —
malformed job fails without retry, handler error retried while attempts remain, job progress kept
across retries), `queue-contracts`
(this project's queue names, job types, their guards and publish options — see
`docs/specs/event-schemas.md`), `kafka-client` (`IEventPublisher`/`IEventConsumer` over `kafkajs`,
plus the outbox: `addOutboxEvent` in the change's transaction, `OutboxRelay` publishes),
`kafka-contracts` (topics, consumer groups, event types and guards), `jewish-calendar` (Shabbat/candle-lighting maths over `@hebcal/core`), `build-info`
(`buildInfo(service)` — the version/build time/start time internal services' `/health` returns), `users-schema` (read-only
TypeORM mappings of the Users Service's tables, for other services to read and reference). Kafka is for events, BullMQ
for jobs. Shared infrastructure is one instance each, reused by every service that needs it:
Postgres (one database, `personal_copilot`, a schema per table-owning service — a service writes
only its own schema and may read others' tables), Redis (BullMQ queues), Kafka (events, not
published to the host).

**Frontend** — Expo Router, file-based routing, `(auth)`/`(tabs)` groups. Redux Toolkit with a
strict services-layer convention: all I/O lives in `src/services/`, split by transport —
`services/http/` (fetch-based calls), `services/ws/` (the Socket.IO client), and
`services/device/` (on-device I/O such as `expo-location` and the browser's push APIs) — called only from thunks in
`src/store/slices/`, never inline in a thunk or a component.

Theming is a three-layer pipeline ported from `ask-my-crawl`, minus its Gluestack layer (nothing
here rendered an actual Gluestack component, so it was left out rather than carried over as inert
plumbing): **1)** `themeSlice` (`mode: null | 'light' | 'dark'`, persisted) **2)** `useAppTheme()`
(derives `isDark`/`colors`/`colorMode` — the only way a screen should read colors) **3)**
`ThemeAnimContext` (a single `Animated.Value`, 600ms interpolations for the transition between
palettes). `src/theme/colors.js` holds the two static palettes (dark indigo/violet space theme,
light indigo/teal). See `frontend/README.md` and `.claude/agents/frontend.md`.

**Observability** — `devops/observability/`: app → OTLP/gRPC → Collector → fans out to Loki
(logs), Prometheus (metrics), Tempo (traces), viewable in Grafana (`:3001`, published directly —
Tailscale is the access boundary, no JWT gate like `ask-my-crawl`'s admin-only proxy). No
dashboards are provisioned yet; see `.claude/agents/devops.md`'s "Grafana dashboards" section for
the rules to follow when adding one per service.

## Key constraints to preserve

- **Gateway is the only *backend* service reachable from outside the Docker network** — `users`,
  and any future internal service, must never get a published port. `frontend` is the one
  intentional exception (a static web export, not a backend service — it calls Gateway for
  everything, same as any other client) — see
  `.claude/memory/feedback_gateway_only_service_access.md`.
- Backend: Application-layer code depends only on interfaces (its own `application/interfaces/`),
  never a concrete Infrastructure class directly; a domain model (`models/`) is not the same thing
  as an `I<Thing>` interface.
- **The frontend only ever talks to Gateway, never the Users Service or any other backend service
  directly** — same hard rule as `ask-my-crawl`, carried over deliberately.
- `OTEL_EXPORTER_OTLP_ENDPOINT` defaults to the Docker network address (`http://otel-
  collector:4317`) — override to `localhost:4317` for a local (non-Docker) run, or telemetry export
  fails silently.
- Gateway's `main.ts` sets `app.set('trust proxy', 'loopback')` so its rate limiter keys on the
  real client IP rather than a proxy's — trust `X-Forwarded-For` only from a loopback peer, never
  broadly (`trust proxy: true`). This is what the cloud deployment's SSH-tunnel hop relies on
  (Caddy → tunnel → Gateway looks like loopback) without letting a directly-reached connection
  (e.g. over Tailscale) spoof its own IP. See `docs/specs/architecture.md`'s "System topology".
