# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this project is

**personal-copilot**: a NestJS + Expo app — Gateway, a Postgres-backed Auth Service, a Calendar
Service, full OTel observability, and a frontend with optional login. The first feature is being
built in stages from [`docs/plans/shabbat-reminders-calendar/plan.md`](docs/plans/shabbat-reminders-calendar/plan.md)
(Shabbat times on Home → per-user candle-lighting reminders → a Jewish-calendar tab); read that
plan and its design pages (`architecture.html`, `mockups.html`) before working on the feature.
Stage 1 (Shabbat times) is live; Reminders and Notification services exist as skeletons. Work the
plan one task at a time and stop for review after each.

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
Gateway/Auth Service split with a shared `auth-kernel` lib, same `devops/<service>/docker-
compose.yml` structure, same `.claude/agents`/`.claude/memory` setup, and — as of this rewrite —
the same frontend theme/component conventions (see the Architecture section's Frontend paragraph).
Deliberately simpler where this project's actual shape allows it: no admin/role system (`UserRole`
has exactly one value), no Gluestack dependency on the frontend (the animated theme pipeline is
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

## Repo layout

```
backend/                 NestJS monorepo — apps/{gateway,auth,calendar,reminders,notifications}
                          + libs/{auth-kernel,otel,kafka-client,kafka-contracts}
frontend/                 Expo/React Native app — login/register (optional, not gated app-wide), a
                          Home tab (clock + Shabbat times), and an auth-gated Account tab;
                          e2e/ holds the containerized Playwright tests
devops/                   docker-compose.yml (app stack) + observability/ (Grafana/Loki/
                          Prometheus/Tempo/OTel, joined to the app stack via a shared Docker
                          network)
docs/specs/               services.md, event-schemas.md, architecture.md (Mermaid diagrams) —
                          source of truth for how it's wired
docs/plans/               staged feature plans + their HTML design pages
```

## What's implemented

- **gateway** (`backend/apps/gateway`) — HTTP + WS, the only backend service reachable from outside
  the Docker network. Rate-limited globally (`@nestjs/throttler`, `THROTTLE_TTL_MS`/
  `THROTTLE_LIMIT`, default 60s/100req) plus a tighter per-route limit on `/auth/register`,
  `/auth/login`, `/auth/refresh`, `/auth/account`
  (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`, default 60s/5req); `/auth/logout` stays on the
  global default since it needs a valid token already, as does `/calendar/*`. Three feature
  modules, with the proxying ones built on one shared forwarder in `src/proxy/`
  (`ServiceHttpClient`, `writeProxyResponse` — `502 <service>_unreachable` when a service is down):
  - `src/auth-proxy/` — thin pass-through to Auth Service, one hardcoded route per operation (not
    a wildcard): `register`, `login`, `refresh`, `logout`, `account` — no guard on any of them
    (that's how you get a token in the first place, and `account` is body-driven the same way, see
    `apps/auth` below). No `/me` — the access token itself carries
    `{ sub, role, email }`, so there's nothing left for a "who am I" endpoint to return that the
    client can't already decode.
  - `src/calendar-proxy/` — `GET /calendar/shabbat` (forwards only `lat`/`lon`/`tz`), unguarded so
    Home works signed out.
  - `src/realtime/` — Socket.IO at `/ws` (token in the handshake's `auth.token`). Generic plumbing
    kept for the next feature: `IRealtimeConnectionService.pushToUser(userId, event, payload)` is
    the entry point a feature module injects to reach a user's live connection. Nothing pushes
    anything over it yet.
- **auth** (`backend/apps/auth`) — HTTP, internal-only (never published to the host — stricter
  than `ask-my-crawl`'s own Auth Service, which still publishes its port as documented debt; this
  project starts without that exception). `POST /auth/register`, `/auth/login`, `/auth/refresh`,
  `/auth/logout` — none return a `user` object, just tokens. `POST /auth/account`
  (`{email, currentPassword, newEmail?, newPassword?}`, at least one of `newEmail`/`newPassword`
  required) verifies `currentPassword` the same way `login` does, applies whichever field(s) are
  present in one atomic update, and always returns a fresh `{access_token, refresh_token}` — one
  endpoint rather than two sequential calls, since an atomic single request rules out a caller
  ever authenticating a second call with an already-stale password. Body-driven rather than
  `JwtAuthGuard`-gated, deliberately consistent with this service's existing stateless pattern
  rather than introducing bearer-token auth for just this one caller. Postgres via
  TypeORM (`users`, `refresh_tokens`), salt+pepper+SHA-256 password hashing (`PASSWORD_PEPPER`),
  15-min access tokens (`{ sub, role, email }` payload — the client decodes this instead of a
  separate `/me` call) + 30-day rotating refresh tokens (`backend/libs/auth-kernel` for the
  shared JWT sign/verify + guard).
- **calendar** (`backend/apps/calendar`) — HTTP, internal-only, stateless. `GET /calendar/shabbat?
  lat&lon&tz` → the Shabbat in progress, else the next one, for that location: `{ candleLighting,
  havdalah, parasha, holidays, isNow }`. `@hebcal/core` v6 behind `ICalendarCalculator`; "today"
  is the user's date in `tz`; Israel rules and 20-min candle lighting when `tz` is
  `Asia/Jerusalem`, else 18 min. See `backend/apps/calendar/README.md` for the ESM-import and
  time-zone gotchas.
- **reminders** / **notifications** (`backend/apps/{reminders,notifications}`) — internal-only
  skeletons: OTel, `/health`, and a TypeORM connection to their own database
  (`REMINDERS_DATABASE_URL` / `NOTIFICATIONS_DATABASE_URL`) in the shared Postgres, created by
  `devops/postgres`'s one-shot `postgres-init`. No endpoints yet (plan stage 2).
- **frontend** (`frontend/`) — Expo Router app. Login is optional app-wide, not a gate on the whole
  app — `(tabs)` routes are freely reachable while signed out; `(auth)/{login,register}` each add a
  "Continue without logging in" link back to `/` for whoever lands there without wanting to
  authenticate. `(tabs)/index` (Home — the landing tab, no session required: live clock, today's
  Gregorian and Hebrew/Jewish date (`@hebcal/hdate`, see `frontend/README.md` for why not `Intl`),
  a live/disconnected connection chip read straight from `wsSlice.status` — always "Disconnected"
  while signed out, since the socket only opens with a token — and `ShabbatSection`: candle
  lighting, Havdalah, holiday/parasha label, and a countdown for the device's GPS location, fetched
  on first mount, after the GPS fix, after Havdalah passes, and on Retry; last location and result
  persisted for offline), `(tabs)/account`
  (theme toggle, logged-in account, edit email/password via `AccountEditForm`, logout — the one tab
  so far opted into `requiresAuth: true`; the shared `CustomTabBar` intercepts a press on it while
  signed out and shows `ConfirmModal` instead of navigating, but a direct hit on the route — deep
  link, web refresh — bypasses that, so the screen itself also calls `useRequireAuth()` on mount and
  renders `RequireAuthNotice` instead — both generic and reusable by any future `requiresAuth` tab,
  not Account-specific). Redux Toolkit, services-layer convention (all I/O in
  `src/services/`, split by transport — `http/`, `ws/`, and `device/` (location) — called only
  from thunks in `src/store/slices/`). Socket.IO
  auto-connects whenever `authSlice.accessToken` changes (`app/_layout.js`'s
  `RealtimeConnectionManager`) — generic plumbing, same as Gateway's `/ws`; nothing listens for a
  specific event yet. Themed via the three-layer pipeline described in the Architecture section
  below — `GlowCard`/`GradientButton`/`InputField`/`Alert` (`src/components/base/`, split into
  `background`/`buttons`/`feedback`/`form`/`layout` subfolders by purpose — see
  `.claude/agents/frontend.md`) and `AmbientBackground` (`src/components/composite/`) are the
  shared building blocks login/register/
  Home/Account all use; `ConfirmModal` (composite) is the shared
  Yes/No overlay (used today by the `requiresAuth` tab-press guard and Account's logout
  confirmation).
- **Kafka** runs (`devops/kafka/docker-compose.yml`) as generic plumbing, but nothing produces or
  consumes yet — `backend/libs/kafka-contracts` is an empty shell, ready for the next feature to
  fill in. Gateway's WS layer (above) is the same kind of kept-but-unused plumbing.

## First run

1. `cd devops/observability && docker compose up -d` (telemetry stack must exist first —
   `devops/docker-compose.yml` references its network as `external: true`).
2. `cd devops && cp .env.example .env` and set real random `JWT_SECRET`/`PASSWORD_PEPPER`.
   `GATEWAY_PUBLIC_URL`: `http://localhost:8000` for use on this PC only, or the HTTPS tailnet URL
   from step 4 for your phone.
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
npx nest start gateway --watch     # or: auth, calendar, reminders, notifications
npm test                           # jest.config.js — unit + API tests
npm run lint
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
domain layer) enforced in every app — see `.claude/agents/backend.md` before writing backend code.
Shared code lives in `backend/libs/`: `auth-kernel` (JWT sign/verify, `JwtAuthGuard`,
`CurrentUser`), `otel` (generic OTel bootstrap, ported unmodified from `ask-my-crawl`),
`kafka-client` (generic `IEventPublisher`/`KafkajsEventPublisher`, same origin), `kafka-contracts`
(this project's own topics/message shapes — currently empty, see `docs/specs/event-schemas.md`).

**Frontend** — Expo Router, file-based routing, `(auth)`/`(tabs)` groups. Redux Toolkit with a
strict services-layer convention: all I/O lives in `src/services/`, split by transport —
`services/http/` (fetch-based calls), `services/ws/` (the Socket.IO client), and
`services/device/` (on-device I/O such as `expo-location`) — called only from thunks in
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

- **Gateway is the only *backend* service reachable from outside the Docker network** — `auth`,
  and any future internal service, must never get a published port. `frontend` is the one
  intentional exception (a static web export, not a backend service — it calls Gateway for
  everything, same as any other client) — see
  `.claude/memory/feedback_gateway_only_service_access.md`.
- Backend: Application-layer code depends only on interfaces (its own `application/interfaces/`),
  never a concrete Infrastructure class directly; a domain model (`models/`) is not the same thing
  as an `I<Thing>` interface.
- **The frontend only ever talks to Gateway, never Auth Service or any other backend service
  directly** — same hard rule as `ask-my-crawl`, carried over deliberately.
- `OTEL_EXPORTER_OTLP_ENDPOINT` defaults to the Docker network address (`http://otel-
  collector:4317`) — override to `localhost:4317` for a local (non-Docker) run, or telemetry export
  fails silently.
- Gateway's `main.ts` sets `app.set('trust proxy', 'loopback')` so its rate limiter keys on the
  real client IP rather than a proxy's — trust `X-Forwarded-For` only from a loopback peer, never
  broadly (`trust proxy: true`). This is what the cloud deployment's SSH-tunnel hop relies on
  (Caddy → tunnel → Gateway looks like loopback) without letting a directly-reached connection
  (e.g. over Tailscale) spoof its own IP. See `docs/specs/architecture.md`'s "System topology".
