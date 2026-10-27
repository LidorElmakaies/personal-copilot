# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this project is

**personal-copilot**: an Android app (Expo/React Native, built as an APK) that computes Shabbat
times and the Jewish calendar on the phone and keeps its reminders there as local notifications —
no login, no server — plus a dormant NestJS backend: Gateway and a Postgres-backed Users Service
(login + profiles), with full OTel observability, called only by the app's hidden login/account
screens and not started by default.
The feature work is staged in [`docs/plans/finance/plan.md`](docs/plans/finance/plan.md), its
design in [`docs/plans/finance/README.md`](docs/plans/finance/README.md), its screens in the Claude
design canvas linked at the top of the plan; read them before working on the feature. The current architecture is `docs/specs/`.
Progress lives in the plan's checkboxes; "What's implemented" below is what exists now. Work a
plan one task at a time and stop for review after each. **Docs are updated in the same stage as
the code they describe** (each stage's "Docs" line; the `docs` agent sweeps at the end of each
phase) — never saved up for the end.

Runs on the user's personal PC, reached from their phone via **Tailscale**. By default the PC runs
only `apk` (`devops/apk/`): a Caddy serving the APK registry the app installs and updates from,
published on `127.0.0.1:8081`. `tailscale serve` (`devops/tailscale/serve.js`) puts it behind HTTPS
at `https://<pc>.ts.net/apk/`, and the dormant `gateway` (the only backend service published to the
host) at `:8443` while the backend profile runs — Android blocks plain HTTP. See
`docs/specs/architecture.md`'s "System topology".

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
component (`frontend`, `gateway`, `users`) — each component's own;
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
backend/                  NestJS monorepo — apps/{gateway,users}
                          + libs/{auth-kernel,build-info,otel}
frontend/                 Expo/React Native app, built as an Android APK;
                          src/lib/jewish-calendar/ holds the calendar maths;
                          maestro/ the phone smoke-test flows
devops/                   docker-compose.yml (app stack: apk, plus the dormant gateway/users/
                          postgres behind the `backend` profile)
                          + apk/ (Caddy serving the APK registry at /apk/)
                          + android/ (the APK builder image + apk.js: build/publish)
                          + maestro/ (Maestro + adb image, smoke.js: phone smoke tests)
                          + tailscale/serve.js (HTTPS on the tailnet)
                          + icons/render.js (the app's PNG icons, in a pinned Playwright image)
                          + observability/ (Grafana/Loki/Prometheus/Tempo/OTel, joined to
                          the backend services via a shared Docker network)
docs/specs/               services.md, architecture.md (Mermaid diagrams) —
                          source of truth for how it's wired
docs/<service>/           environment.md — every variable each service reads
docs/plans/               staged feature plans; each links its screens, a Claude design
                          canvas (see .claude/agents/frontend.md) — no HTML mockups in the repo
version/versions.json     every version (one per component) — see "Versions" above
scripts/version.js        the only way to bump them (Node, + version.test.js)
scripts/secrets.js        secrets between PCs (+ secrets.test.js) — see Commands
scripts/docs-check.js     docs drift check (+ docs-check.test.js) — see Commands
```

## What's implemented

Each service's contract is in [`docs/specs/services.md`](docs/specs/services.md), diagrams in
[`docs/specs/architecture.md`](docs/specs/architecture.md).

- **frontend** (`frontend/`) — Expo Router app, built as an Android APK; login optional. Swipeable
  tabs: Home (clock, Hebrew date, Shabbat times for the GPS location, the candle-lighting reminder
  bell) and Calendar (Jewish-calendar month; the user's own reminders, added and edited in a bottom
  sheet). Shabbat times and months are computed on the phone (`src/lib/jewish-calendar/`, over
  `@hebcal/core`). Both kinds of reminder need no login, are kept on the phone (persisted) and fired
  as local notifications (`ReminderScheduleManager` → `reconcileReminderNotifications`, a 30-day
  window, at most 100 scheduled; also a daily background task, `reminder-notifications`, so the
  window keeps moving with the app unopened). Account (theme, notifications, email/password,
  profile, log out, delete account, version) and Admin (service status) are `hidden: true` in
  `TABS`: out of the bar and the swipe, a direct link still opens them. No tab in the bar switches
  the theme; it stays the saved mode (system by default). App-wide (`app/_layout.js`): Android's
  notification permission (`notificationsSlice`; `NotificationsPrompt`, a one-time "Turn on
  notifications?" over any tab once a reminder exists and Android can still ask; Log Out leaves
  notifications alone — they're the phone's) and the in-app update from the APK registry (checked
  on start and back in the foreground). `index.js` loads the foreground notification handler
  (`src/shared/device/notificationDisplay.js`) and the background tasks before the app.
  Only the dormant login/account screens call a backend: `EXPO_PUBLIC_GATEWAY_ORIGIN` is
  optional, and the dormant `AuthGate` (token renewal) is not mounted. See
  `docs/specs/services.md#frontend`, `frontend/README.md` and `.claude/agents/frontend.md`.
- **apk** (`devops/apk/`) — `caddy:2-alpine` serving `devops/data/apk` (written by
  `node devops/android/apk.js publish`) read-only at `/apk/`: the download page, `latest.json` and
  every published APK. The one service `docker compose up -d` starts.
- **gateway** (`backend/apps/gateway`) — dormant (backend profile). HTTP, the only backend service
  reachable from outside the Docker network. Rate-limited per client IP: a global limit
  (`THROTTLE_TTL_MS`/`THROTTLE_LIMIT`, default 60 s/100) and a strict one (`AUTH_THROTTLE_TTL_MS`/
  `AUTH_THROTTLE_LIMIT`, 60 s/5) on `/auth/register`, `/login`, `/refresh` and `/account`. Modules:
  - `src/proxy/` — every route forwarded to an internal service is one row of `PROXY_ROUTES`
    (`proxy.routes.ts`): method, path, target service, `auth: 'user'` (`JwtAuthGuard`, the user id
    forwarded as `X-User-Id`) or `'none'`, `throttle`. Unlisted → `404`. All to Users: `/auth/*`,
    `/users/me*`.
  - `src/admin/` — `GET /admin/status` (`AdminGuard`): Gateway's and Users' versions and up/down.
- **users** (`backend/apps/users`) — dormant (backend profile). Internal-only, schema `users`.
  Register/login/refresh/logout return only tokens: a 15-min access token carrying
  `{ sub, role, email }` (no `/me`) and a 30-day rotating refresh token. `POST`/`DELETE
  /auth/account` (change email/password, delete — body-driven, proven by `currentPassword`).
  Profiles (name, phone, location) behind `GET`/`PATCH /users/me` and `PUT /users/me/location`
  (which the app never calls). Name/phone rules in `apps/users/src/models/profile.ts`. TypeORM
  migrations (`src/infrastructure/postgres/migrations/`) run on every boot — see
  `backend/apps/users/README.md`.

## First run

1. `cp devops/.env.example devops/.env`. Only for the backend profile, also `cp backend/.env.example
   backend/.env` (every backend container reads it) and set a real random `JWT_SECRET` (the same in
   both) and `PASSWORD_PEPPER` (`backend/.env`).
2. Phone access: run `node devops/tailscale/serve.js` once (see README's "Phone access (Tailscale
   HTTPS)" for the one-time Tailscale setup) and put the registry URL it prints into
   `APK_REGISTRY_URL` (or the Gateway URL into `GATEWAY_PUBLIC_URL`, whose host it defaults to).
3. `cd devops && docker compose up -d` — starts `apk`, the registry at
   `https://<pc>.ts.net/apk/`.
4. Build and publish the APK (see Commands), then install it from that page on the phone.
5. Only for the dormant backend: `cd devops/observability && docker compose up -d` first (the
   backend services join its network, declared `external: true`), then
   `cd devops && docker compose --profile backend up -d --build`.

## Commands

Backend (run from `backend/`):
```bash
npm install
npx nest start gateway --watch     # or: users
npm test                           # jest.config.js — unit + API tests
# Opt-in real-Postgres tests run on the stack's network — see the command atop
# apps/users/test/typeorm-repositories.it.spec.ts
npm run lint
```

Android app (from the repo root, Linux or Windows; `build` runs in Docker — see README's "Android app (APK)"):
```bash
node devops/android/apk.js build              # → devops/data/android/apk/personal-copilot-<frontend version>.apk
node devops/android/apk.js publish "note" ... # → devops/data/apk/, served at https://<pc>.ts.net/apk/
node --test devops/android/apk.test.js        # publisher tests, on the host
```

Phone smoke tests (opt-in release check, never part of `npm test`; the installed APK on a USB phone,
Maestro in Docker — see `.claude/agents/testing.md`'s "On the phone"):
```bash
node devops/maestro/smoke.js                  # Home's Shabbat times, a reminder added, its notification (≤ ~9 min)
node devops/maestro/smoke.js --quick          # the same, checking the alarm is set without waiting (~2.5 min)
node devops/maestro/smoke.js --device <ip:port> # over wireless debugging (Windows: Docker has no USB)
node --test devops/maestro/smoke.test.js      # its tests, on the host
```

Secrets between PCs (never git — one encrypted file kept in Google Drive by hand; see README's "Secrets between PCs"):
```bash
node scripts/secrets.js pull | push | status | init  # secrets/secrets.enc + secrets/secrets-key.json (gitignored, kept in Google Drive)
```

App icons (from the repo root, after editing `frontend/assets/icon/icon.svg`; runs in Docker):
```bash
node devops/icons/render.js
```

Frontend (run from `frontend/`):
```bash
npm install
npx expo start          # Expo Go / dev client
npm test                # jest.config.js (jest-expo) — the *.spec.{ts,js} under src/
```

Docs drift check (from the repo root, plain Node — a task isn't done while it fails):
```bash
node scripts/docs-check.js            # every doc ↔ code check; file:line for each problem, exit 1 if any
node scripts/docs-check.js --changed  # first lists the docs your uncommitted changes touch (DOCS_MAP)
node --test "scripts/*.test.js"       # tests of version.js, docs-check.js and secrets.js
```

Stack: see "First run" above — `docker compose up -d` for the registry; for the backend profile,
`devops/observability` first, every time.

## Architecture

NestJS monorepo, clean/hexagonal layering (API → Application → Infrastructure, plus a `models/`
domain layer and an `entities/` folder for TypeORM table mappings) enforced in every app — see
`.claude/agents/backend.md` before writing backend code.
Shared code lives in `backend/libs/` (each described in `docs/specs/services.md`): `auth-kernel`
(JWT sign/verify, `JwtAuthGuard`, `AdminGuard`, the forwarded user id), `build-info` (what `/health`
reports), `otel` (generic OTel bootstrap, ported unmodified from `ask-my-crawl`). Postgres is one instance: one database, `personal_copilot`, a
schema per table-owning service, each writing only its own.

**Frontend** — Expo Router, file-based routing, `(auth)`/`(tabs)` groups; the route files only
render a screen from a feature folder, `src/features/<name>/` (`shabbat`, `calendar`, `reminders`,
`app-update`, and the dormant `account`), each with its components, slice, services, utils and an
`index.js` — the only way another feature may import it. Cross-feature code is `src/shared/`
(never imports a feature), the calendar maths `src/lib/jewish-calendar/`, the root store
`src/store/index.js`. Redux Toolkit with a strict services-layer convention: all I/O lives in a
feature's `services/` or `src/shared/` (`device/`, `http/`), called only from thunks,
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
  whose Auth Service still publishes its port). `apk` is the one intentional exception (a static
  file server on `127.0.0.1:8081`, not a backend service) — see
  `.claude/memory/feedback_gateway_only_service_access.md`.
- Backend: Application-layer code depends only on interfaces (`application/interfaces/`, or
  `infrastructure/interfaces/` for the ports its adapters implement, e.g. repositories), never a
  concrete Infrastructure class directly; a domain model (`models/`) is not the same thing
  as an `I<Thing>` interface.
- **The frontend only ever talks to Gateway, never the Users Service or any other backend service
  directly** — same hard rule as `ask-my-crawl`, carried over deliberately. The one exception is
  read-only static files: the app's update check fetches `latest.json` and the APK from `apk`'s
  Caddy (`/apk/`) — no API call ever bypasses Gateway.
- **The app is Israel-only.** Every calendar calculation uses Israel's rules and time zone
  (`ISRAEL_TIME_ZONE`) wherever the GPS point is; no time zone is sent or stored anywhere. See
  `docs/specs/services.md#calendar-maths`.
- `OTEL_EXPORTER_OTLP_ENDPOINT` defaults to the Docker network address (`http://otel-
  collector:4317`) — override to `localhost:4317` for a local (non-Docker) run, or telemetry export
  fails silently.
- Gateway's port is published on `127.0.0.1` only (`devops/gateway/docker-compose.yml`): every
  connection comes through a local proxy (`tailscale serve`) arriving through Docker's
  bridge. That is what makes `src/trust-proxy.ts`'s `TRUST_PROXY` (loopback + private networks)
  safe, so the rate limiter keys on the real client IP. Never publish the port on all interfaces or
  widen the trust to `true`: a directly-reached caller could then pick its own IP. See
  `docs/specs/architecture.md`'s "System topology".
