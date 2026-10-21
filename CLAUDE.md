# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this project is

**personal-copilot**: a NestJS + Expo app — Gateway, a Postgres-backed Users Service (login +
profiles), a Reminders Service (candle-lighting reminders and the user's own reminders), a
Notification Service (Web Push + FCM), full OTel observability, and a frontend with optional login.
The first feature is being built in stages from
[`docs/plans/shabbat-reminders-calendar/plan.md`](docs/plans/shabbat-reminders-calendar/plan.md)
(Shabbat times on Home → per-user candle-lighting reminders → a Jewish-calendar tab); read that
plan and its design pages (`architecture.html`, `mockups.html`) before working on the feature.
Progress lives in that plan's checkboxes; "What's implemented" below is what exists now. Work the
plan one task at a time and stop for review after each.

Hosted on the user's personal PC, reachable from their phone via **Tailscale** — `gateway` is the
only backend service published to the host (`frontend` also has its own published port — it's a
static web export, not a backend service, see "Key constraints" below). `tailscale serve`
(`devops/tailscale/serve.js`) puts both behind HTTPS on the PC's `*.ts.net` name, which phone
browsers require for GPS. A second, optional deployment path also exists in code (not yet live
infra): `frontend` built and run standalone on a Hetzner VPS behind Caddy, reaching `gateway` back
on the home machine over an SSH reverse tunnel — see `docs/specs/architecture.md`'s "System
topology" and "SSH reverse-tunnel hardening" sections. Tailscale remains the primary access path
either way.

**Deliberately bootstrapped to match a sibling project's conventions** — `ask-my-crawl`, a separate
repo not checked out on this machine — same NestJS Nest-CLI monorepo shape, same clean/hexagonal
layering, same Gateway/auth-service split (here the Users Service) with a shared `auth-kernel` lib,
same `devops/<service>/docker-compose.yml` structure, same `.claude/agents`/`.claude/memory` setup,
and the same frontend theme/component conventions (see the Architecture section's Frontend
paragraph). Deliberately simpler where this project's actual shape allows it: `UserRole` is
`'user' | 'admin'`, and the only admin is a one-time seeded account that uses the app like any user
plus an Admin tab of service status (`AdminGuard` on `GET /admin/status`) — see
`docs/specs/services.md#users`; no Gluestack dependency on the frontend (see `frontend/README.md`).
The current look (space/glow/gradient) is a known stepping-stone, not a final design — expect it to
be replaced by a different, more animated style later.

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

Every version lives in [`version/versions.json`](version/versions.json), one per deployable
component (`frontend`, `gateway`, `users`, `reminders`, `notifications`) — each component's own;
there's no project-wide version. Semver `MAJOR.MINOR.PATCH`: major = breaks or changes how the app
works, minor = a feature or an important API/route change, patch = a small fix; bumping one part
resets the parts to its right. Test builds while fixing are `-test.N` (`1.3.0-test.1`, `-test.2`, …);
the release drops it (`1.3.0`). Bump only with `node scripts/version.js` — it applies those rules; it
never touches git (it prints the tag to add after the commit, per component: `gateway-v0.3.0`).

**After every change, ask the user which components to bump and how, with a suggestion** (e.g.
"Gateway: minor (new route), frontend: patch?"). Never bump without the answer.
A change to a shared `backend/libs/` library bumps each service that uses it. Changes to docs,
plans, tests or agent files only don't bump anything; a `devops/` change that alters how a service
runs is a patch for that service. Where each version is baked in and shown:
`docs/specs/services.md#versions`. Applies to every agent in `.claude/agents/` too.

## Repo layout

```
backend/                  NestJS monorepo — apps/{gateway,users,reminders,notifications}
                          + libs/{auth-kernel,build-info,jewish-calendar,kafka-client,
                          kafka-contracts,otel,queue-client,queue-contracts,users-schema}
frontend/                 Expo/React Native app (web export + Android APK);
                          public/ holds the Web Push service worker and the web manifest;
                          e2e/ holds the containerized Playwright tests
devops/                   docker-compose.yml (app stack: services + shared postgres/redis/kafka)
                          + android/ (the APK builder image + apk.js: build/publish)
                          + observability/ (Grafana/Loki/Prometheus/Tempo/OTel, joined to
                          the app stack via a shared Docker network)
docs/specs/               services.md, event-schemas.md (Kafka events, queue jobs), notification-flow.md,
                          architecture.md (Mermaid diagrams) —
                          source of truth for how it's wired
docs/<service>/           environment.md — every variable each service reads
docs/plans/               staged feature plans + their HTML design pages
version/versions.json     every version (one per component) — see "Versions" above
scripts/version.js        the only way to bump them (Node, + version.test.js)
scripts/docs-check.js     docs drift check (+ docs-check.test.js) — see Commands
```

## What's implemented

Each service's contract is in [`docs/specs/services.md`](docs/specs/services.md), queue jobs and
Kafka events in [`docs/specs/event-schemas.md`](docs/specs/event-schemas.md), diagrams in
[`docs/specs/architecture.md`](docs/specs/architecture.md) and
[`docs/specs/notification-flow.md`](docs/specs/notification-flow.md).

- **gateway** (`backend/apps/gateway`) — HTTP + WS, the only backend service reachable from outside
  the Docker network. Rate-limited per client IP: a global limit (`THROTTLE_TTL_MS`/
  `THROTTLE_LIMIT`, default 60 s/100) and a strict one (`AUTH_THROTTLE_TTL_MS`/
  `AUTH_THROTTLE_LIMIT`, 60 s/5) on `/auth/register`, `/login`, `/refresh`, `/account` and
  `/realtime/device`. Modules:
  - `src/proxy/` — every route forwarded to an internal service is one row of `PROXY_ROUTES`
    (`proxy.routes.ts`): method, path, target service, `auth: 'user'` (`JwtAuthGuard`, the user id
    forwarded as `X-User-Id`) or `'none'`, `throttle`. Unlisted → `404`. Users: `/auth/*`,
    `/users/me*`; Reminders: `/reminders*`; Notifications: `/notifications/*`.
  - `src/calendar/` — `GET /calendar/shabbat` and `GET /calendar/month` (open), answered
    in-process from `@app/jewish-calendar`. No longer called by the app (it computes them itself).
  - `src/realtime/` — `POST /realtime/device` (a device token per app install) and Socket.IO at
    `/ws` (device token required, plus the access token once signed in; one connection per
    device). A feature module pushes with `IRealtimeConnectionService` (`pushToUser`/`broadcast`).
  - `src/app-update/` — consumes Kafka's `frontend.releases`, broadcasts `app-update`.
  - `src/admin/` — `GET /admin/status` (`AdminGuard`): every service's version and up/down.
- **users** (`backend/apps/users`) — internal-only, schema `users`. Register/login/refresh/logout
  return only tokens: a 15-min access token carrying `{ sub, role, email }` (no `/me`) and a 30-day
  rotating refresh token. `POST`/`DELETE /auth/account` (change email/password, delete — body-driven,
  proven by `currentPassword`). Profiles (name, phone, location) behind `GET`/`PATCH /users/me` and
  `PUT /users/me/location`; every change and deletion goes out on Kafka `users.user-state` through
  the outbox. Deleting an account removes other services' rows through `ON DELETE CASCADE`.
- **reminders** (`backend/apps/reminders`) — internal-only, schema `reminders`. The candle-lighting
  reminder (`GET /reminders`, `PUT`/`DELETE /reminders/shabbat-candles`) and the user's own
  reminders (`/reminders/custom*`: once / daily / monthly / yearly, Gregorian or Hebrew, skipped
  days). Reads the user's location from `users.profiles` (read-only). Each reminder keeps one
  delayed `reminder-due` job at its next firing (`ReminderScheduler`, `CustomReminderScheduler`),
  which publishes `notification-requested` and queues the next; a sweep at startup and every
  15 min re-queues any missing job and removes those of deleted reminders.
- **notifications** (`backend/apps/notifications`) — internal-only, schema `notifications`. Stores
  browsers' Web Push subscriptions and the Android app's FCM devices, and delivers
  `notification-requested` jobs to them end-to-end encrypted (`WebPushChannel`, `FcmChannel`),
  retrying only the devices not yet reached, never after `expiresAt`. Won't boot without `VAPID_*`;
  FCM is off without the optional `FCM_*`.
- **frontend** (`frontend/`) — Expo Router app, web export and Android APK; login optional. Swipeable
  tabs: Home (clock, Hebrew date, Shabbat times for the GPS location — computed on the phone, like
  the months — the candle-lighting reminder bell), Calendar (Jewish-calendar month; signed in, the user's own reminders, added and edited in a
  bottom sheet), Account (signed in only: theme, notifications, email/password, profile, log out,
  delete account, version) and Admin (admins only: service status). App-wide (`app/_layout.js`):
  one Socket.IO connection per install, location sync after a > 5 km move, quiet token renewal,
  notifications (Web Push via `public/sw.js`, FCM in the APK) and the APK's in-app update. See
  `docs/specs/services.md#frontend`, `frontend/README.md` and `.claude/agents/frontend.md`.
- **Queues and events** — BullMQ on Redis for jobs (`notification-requested`, `reminder-due`;
  `@app/queue-contracts`, and every `notification-requested` publisher enqueues with
  `notificationRequestedPublishOptions`), Kafka for events (`users.user-state`,
  `frontend.releases`; `@app/kafka-contracts`).

## First run

1. `cd devops/observability && docker compose up -d` (telemetry stack must exist first —
   `devops/docker-compose.yml` references its network as `external: true`).
2. `cd devops && cp .env.example .env` and set a real random `JWT_SECRET`.
   `GATEWAY_PUBLIC_URL`: `http://localhost:8000` for use on this PC only, or the HTTPS tailnet URL
   from step 4 for your phone. Also `cp backend/.env.example backend/.env` (every container reads
   it): the same `JWT_SECRET`, a real random `PASSWORD_PEPPER`, and `VAPID_*` keys from `npx web-push
   generate-vapid-keys` — without them Notifications won't boot, so Gateway (which waits for it to be healthy) won't either.
3. `docker compose up -d --build`.
4. Phone access: run `node devops/tailscale/serve.js` once (see README's "Phone access (Tailscale
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
# Opt-in real-Redis tests — a throwaway Redis, never one holding real queues (they empty them):
docker run --rm -d --name redis-it -p 127.0.0.1:6390:6379 redis:7.4-alpine
REDIS_IT_URL=redis://127.0.0.1:6390 npx jest notification-flow.it queue-roundtrip; docker stop redis-it
# Opt-in real-Postgres tests run on the stack's network — see the commands atop
# apps/users/test/typeorm-repositories.it.spec.ts and apps/reminders/test/shared-database.it.spec.ts
npm run lint
```

Android app (from the repo root, Linux or Windows; `build` runs in Docker — see README's "Android app (APK)"):
```bash
node devops/android/apk.js build              # → devops/data/android/apk/personal-copilot-<frontend version>.apk
node devops/android/apk.js publish "note" ... # → devops/data/apk/, served at https://<pc>.ts.net/apk/
node --test devops/android/apk.test.js        # publisher tests, on the host
```

Secrets between PCs (never git — one encrypted file kept in Google Drive by hand; see README's "Secrets between PCs"):
```bash
node scripts/secrets.js pull | push | status  # secrets/secrets.enc + secrets/secrets-key.json (gitignored, kept in Google Drive)
```

Send a user their candle-lighting reminder's notification now, to check delivery (see
`docs/specs/notification-flow.md`):
```bash
node scripts/fire-reminder.js <email> [minutes=2]
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
npm test                # jest.config.js (jest-expo) — the *.spec.{ts,js} under src/
```

Docs drift check (from the repo root, plain Node — a task isn't done while it fails):
```bash
node scripts/docs-check.js            # every doc ↔ code check; file:line for each problem, exit 1 if any
node scripts/docs-check.js --changed  # first lists the docs your uncommitted changes touch (DOCS_MAP)
node --test "scripts/*.test.js"       # tests of version.js, docs-check.js and secrets.js
```

Full stack: see "First run" above — same two-command sequence (`devops/observability` before
`devops/`) every time.

## Architecture

NestJS monorepo, clean/hexagonal layering (API → Application → Infrastructure, plus a `models/`
domain layer and an `entities/` folder for TypeORM table mappings) enforced in every app — see
`.claude/agents/backend.md` before writing backend code.
Shared code lives in `backend/libs/` (each described in `docs/specs/services.md`): `auth-kernel`
(JWT sign/verify, `JwtAuthGuard`, `AdminGuard`, the forwarded user id), `build-info` (what `/health`
reports), `jewish-calendar` (all calendar maths: Shabbat times, month calendars, custom reminders'
repeat rules — over `@hebcal/core`, see its README), `kafka-client` + `kafka-contracts` (events and
the outbox), `otel` (generic OTel bootstrap, ported unmodified from `ask-my-crawl`),
`queue-client` + `queue-contracts` (BullMQ jobs), `users-schema` (read-only mappings of the Users
Service's tables). Kafka is for events, BullMQ for jobs. Shared infrastructure is one instance each,
reused by every service that needs it: Postgres (one database, `personal_copilot`, a schema per
table-owning service — a service writes only its own schema and may read others' tables), Redis
(BullMQ queues), Kafka (events, not published to the host).

**Frontend** — Expo Router, file-based routing, `(auth)`/`(tabs)` groups; the route files only
render a screen from a feature folder, `src/features/<name>/` (`shabbat`, `calendar`, `reminders`,
`app-update`, and the dormant `account`), each with its components, slice, services, utils and an
`index.js` — the only way another feature may import it. Cross-feature code is `src/shared/`
(never imports a feature), the calendar maths `src/lib/jewish-calendar/`, the root store
`src/store/index.js`. Redux Toolkit with a strict services-layer convention: all I/O lives in a
feature's `services/` or `src/shared/` (`device/`, `http/`, `realtime/`), called only from thunks,
never inline in a thunk or a component.

Theming is a two-layer pipeline ported from `ask-my-crawl`, minus its Gluestack layer: **1)**
`themeSlice` (`mode: null | 'light' | 'dark'`, persisted) **2)** `useAppTheme()` (derives
`isDark`/`colors`/`colorMode` — the only way a screen should read colors). `src/shared/theme/colors.js`
holds the two static palettes. See `frontend/README.md` and `.claude/agents/frontend.md`.

**Observability** — `devops/observability/`: app → OTLP/gRPC → Collector → fans out to Loki
(logs), Prometheus (metrics), Tempo (traces), viewable in Grafana (`:3001`, published directly —
Tailscale is the access boundary, no JWT gate like `ask-my-crawl`'s admin-only proxy). No
dashboards are provisioned yet; see `.claude/agents/devops.md`'s "Grafana dashboards" section for
the rules to follow when adding one per service.

## Key constraints to preserve

- **Gateway is the only *backend* service reachable from outside the Docker network** — `users`,
  and any future internal service, must never get a published port (stricter than `ask-my-crawl`,
  whose Auth Service still publishes its port). `frontend` is the one intentional exception (a
  static web export, not a backend service — it calls Gateway for everything, same as any other
  client) — see `.claude/memory/feedback_gateway_only_service_access.md`.
- Backend: Application-layer code depends only on interfaces (`application/interfaces/`, or
  `infrastructure/interfaces/` for the ports its adapters implement, e.g. repositories), never a
  concrete Infrastructure class directly; a domain model (`models/`) is not the same thing
  as an `I<Thing>` interface.
- **The frontend only ever talks to Gateway, never the Users Service or any other backend service
  directly** — same hard rule as `ask-my-crawl`, carried over deliberately. The one exception is
  read-only static files: the APK's update check fetches `latest.json` and the APK from the
  frontend's own Caddy (`/apk/`) — no API call ever bypasses Gateway.
- **The app is Israel-only.** Every calendar calculation uses Israel's rules and time zone
  (`ISRAEL_TIME_ZONE`) wherever the GPS point is; no time zone is sent or stored anywhere. See
  `docs/specs/services.md#libsjewish-calendar`.
- `OTEL_EXPORTER_OTLP_ENDPOINT` defaults to the Docker network address (`http://otel-
  collector:4317`) — override to `localhost:4317` for a local (non-Docker) run, or telemetry export
  fails silently.
- Gateway's port is published on `127.0.0.1` only (`devops/gateway/docker-compose.yml`): every
  connection is a local proxy (`tailscale serve`, the SSH tunnel) arriving through Docker's
  bridge. That is what makes `src/trust-proxy.ts`'s `TRUST_PROXY` (loopback + private networks)
  safe, so the rate limiter keys on the real client IP. Never publish the port on all interfaces or
  widen the trust to `true`: a directly-reached caller could then pick its own IP. See
  `docs/specs/architecture.md`'s "System topology".
