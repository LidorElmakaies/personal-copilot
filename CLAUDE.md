# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this project is

**personal-copilot**: right now, a clean-slate NestJS + Expo scaffold — Gateway, a Postgres-backed
Auth Service, full OTel observability, and a frontend with working login/register. No product
feature is built on top of this yet; a previous Shabbat-notification feature (WhatsApp + location
sharing) was deliberately stripped back out to start fresh. Treat "what's implemented" below as the
actual current scope, not a placeholder for the old feature.

Hosted on the user's personal PC, reachable from their phone via **Tailscale** — `gateway` is the
only backend service published to the host (`frontend` also has its own published port — it's a
static web export, not a backend service, see "Key constraints" below). A second, optional
deployment path also exists in code (not yet live infra): `frontend` built and run standalone on a
Hetzner VPS behind Caddy, reaching `gateway` back on the home machine over an SSH reverse tunnel —
see `docs/specs/architecture.md`'s "System topology" and "SSH reverse-tunnel hardening" sections.
Tailscale remains the primary access path either way.

**Deliberately bootstrapped to match a sibling project's conventions** — `C:\Users\lidor\Desktop\
ask-my-crawl` — same NestJS Nest-CLI monorepo shape, same clean/hexagonal layering, same
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

## Repo layout

```
backend/                 NestJS monorepo — apps/{gateway,auth} + libs/{auth-kernel,otel,
                          kafka-client,kafka-contracts}
frontend/                 Expo/React Native app — login/register, a Home tab, and a Settings tab
devops/                   docker-compose.yml (app stack) + observability/ (Grafana/Loki/
                          Prometheus/Tempo/OTel, joined to the app stack via a shared Docker
                          network)
docs/specs/               services.md, event-schemas.md, architecture.md (Mermaid diagrams) —
                          source of truth for how it's wired
```

## What's implemented

- **gateway** (`backend/apps/gateway`) — HTTP + WS, the only backend service reachable from outside
  the Docker network. Rate-limited globally (`@nestjs/throttler`, `THROTTLE_TTL_MS`/
  `THROTTLE_LIMIT`, default 60s/100req) plus a tighter per-route limit on `/auth/register`,
  `/auth/login`, `/auth/refresh` (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`, default 60s/5req).
  Two modules:
  - `src/auth-proxy/` — thin pass-through to Auth Service: `/auth/*` only (no guard — that's how
    you get a token). No `/me` — the access token itself carries `{ sub, role, email }`, so
    there's nothing left for a "who am I" endpoint to return that the client can't already decode.
  - `src/realtime/` — Socket.IO at `/ws` (token in the handshake's `auth.token`). Generic plumbing
    kept for the next feature: `IRealtimeConnectionService.pushToUser(userId, event, payload)` is
    the entry point a feature module injects to reach a user's live connection. Nothing pushes
    anything over it yet.
- **auth** (`backend/apps/auth`) — HTTP, internal-only (never published to the host — stricter
  than `ask-my-crawl`'s own Auth Service, which still publishes its port as documented debt; this
  project starts without that exception). `POST /auth/register`, `/auth/login`, `/auth/refresh`,
  `/auth/logout` — none return a `user` object, just tokens. Postgres via TypeORM (`users`,
  `refresh_tokens`), salt+pepper+SHA-256 password hashing (`PASSWORD_PEPPER`), 15-min access
  tokens (`{ sub, role, email }` payload — the client decodes this instead of a separate `/me`
  call) + 30-day rotating refresh tokens (`backend/libs/auth-kernel` for the shared JWT sign/
  verify + guard).
- **frontend** (`frontend/`) — Expo Router app. `(auth)/{login,register}`, `(tabs)/index` (Home —
  the landing tab: live clock, today's Gregorian and Hebrew/Jewish date (`@hebcal/hdate`, see
  `frontend/README.md` for why not `Intl`), and a live/disconnected connection chip read straight
  from `wsSlice.status`), `(tabs)/settings` (theme toggle, logged-in account, live connection
  status, logout). Redux Toolkit, services-layer convention (all I/O in `src/services/`, split by
  transport — `http/` and `ws/` — called only from thunks in `src/store/slices/`). Socket.IO
  auto-connects whenever `authSlice.accessToken` changes (`app/_layout.js`'s
  `RealtimeConnectionManager`) — generic plumbing, same as Gateway's `/ws`; nothing listens for a
  specific event yet. Themed via the three-layer pipeline described in the Architecture section
  below — `GlowCard`/`GradientButton`/`InputField`/`AmbientBackground` in `src/components/` are the
  shared building blocks login/register/Home/Settings all use.
- **Kafka** runs (`devops/kafka/docker-compose.yml`) as generic plumbing, but nothing produces or
  consumes yet — `backend/libs/kafka-contracts` is an empty shell, ready for the next feature to
  fill in. Gateway's WS layer (above) is the same kind of kept-but-unused plumbing.

## First run

1. `cd devops/observability && docker compose up -d` (telemetry stack must exist first —
   `devops/docker-compose.yml` references its network as `external: true`).
2. `cd devops && cp .env.example .env` and set real values: `GATEWAY_PUBLIC_URL` to your PC's
   Tailscale MagicDNS name (port 8000 — this is what makes it reachable from your phone), and real
   random `JWT_SECRET`/`PASSWORD_PEPPER`.
3. `docker compose up -d --build`.
4. Open `http://localhost:8081` (or your Tailscale-reachable frontend origin) from your phone,
   register an account, log in.

## Commands

Backend (run from `backend/`):
```bash
npm install
npx nest start gateway --watch     # or: auth
npm test
npm run lint
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
`services/http/` (fetch-based calls) and `services/ws/` (the Socket.IO client) — called only from
thunks in `src/store/slices/`, never inline in a thunk or a component.

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
