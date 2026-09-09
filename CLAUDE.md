# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this project is

**personal-copilot**: right now, a clean-slate NestJS + Expo scaffold — Gateway, a Postgres-backed
Auth Service, a Telegram channel any of your app's registered users can link their chat to, full
OTel observability, and a frontend with working login/register. No product feature is built on top
of the Telegram channel yet — sending/receiving messages once linked is generic plumbing, same
status as Gateway's WS layer; a previous Shabbat-notification feature (WhatsApp + location sharing)
was deliberately stripped back out to start fresh. Treat "what's implemented" below as the actual
current scope, not a placeholder for the old feature.

Hosted on the user's personal PC, reachable from their phone via **Tailscale** — `gateway` is the
only backend service published to the host (`frontend` also has its own published port — it's a
static web export, not a backend service, see "Key constraints" below).

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
backend/                 NestJS monorepo — apps/{gateway,auth,telegram} + libs/{auth-kernel,otel,
                          kafka-client,kafka-contracts}
frontend/                 Expo/React Native app — login/register + a Settings tab
devops/                   docker-compose.yml (app stack) + observability/ (Grafana/Loki/
                          Prometheus/Tempo/OTel, joined to the app stack via a shared Docker
                          network)
docs/specs/               services.md, event-schemas.md, architecture.md (Mermaid diagrams) —
                          source of truth for how it's wired
```

## What's implemented

- **gateway** (`backend/apps/gateway`) — HTTP + WS, the only backend service reachable from outside
  the Docker network. Three modules:
  - `src/auth-proxy/` — thin pass-through to Auth Service: `/auth/*` only (no guard — that's how
    you get a token). No `/me` — the access token itself carries `{ sub, role, email }`, so
    there's nothing left for a "who am I" endpoint to return that the client can't already decode.
  - `src/realtime/` — Socket.IO at `/ws` (token in the handshake's `auth.token`). Generic plumbing
    kept for the next feature: `IRealtimeConnectionService.pushToUser(userId, event, payload)` is
    the entry point a feature module injects to reach a user's live connection. Nothing pushes
    anything over it yet.
  - `src/telegram-proxy/` — `POST /telegram/link-code`, guarded by `JwtAuthGuard` (the first route
    in the app to actually use it). Publishes a Kafka request rather than calling `apps/telegram`
    directly; the minted code arrives back over Kafka too and is pushed to the caller's own WS
    connection (`telegram:link-code` event) — the HTTP response itself is just a 202 ack.
- **auth** (`backend/apps/auth`) — HTTP, internal-only (never published to the host — stricter
  than `ask-my-crawl`'s own Auth Service, which still publishes its port as documented debt; this
  project starts without that exception). `POST /auth/register`, `/auth/login`, `/auth/refresh`,
  `/auth/logout` — none return a `user` object, just tokens. Postgres via TypeORM (`users`,
  `refresh_tokens`), salt+pepper+SHA-256 password hashing (`PASSWORD_PEPPER`), 15-min access
  tokens (`{ sub, role, email }` payload — the client decodes this instead of a separate `/me`
  call) + 30-day rotating refresh tokens (`backend/libs/auth-kernel` for the shared JWT sign/
  verify + guard).
- **frontend** (`frontend/`) — Expo Router app. `(auth)/{login,register}`, `(tabs)/index` (Settings
  — theme toggle, logged-in account, Telegram linking, live connection status, logout). Redux
  Toolkit, services-layer convention (all I/O in `src/services/`, split by transport — `http/` and
  `ws/` — called only from thunks in `src/store/slices/`). Socket.IO auto-connects whenever
  `authSlice.accessToken` changes (`app/_layout.js`'s `RealtimeConnectionManager`) — generic
  plumbing, same as Gateway's `/ws`; Settings' own `telegram:link-code` listener (registered via
  `socketService.getSocket()`) is the first feature-specific one. Themed via the three-layer
  pipeline described in the Architecture section below — `GlowCard`/`GradientButton`/`InputField`/
  `SpaceBackground` in `src/components/` are the shared building blocks login/register/Settings all
  use.
- **telegram** (`backend/apps/telegram`) — internal-only, **no HTTP surface at all**. A
  long-polling bot (via `grammy`, outbound-only) that accepts messages from anyone; everything else
  it does — the linking round trip and all message send/receive — goes through Kafka. Any chat can
  message the bot, but it does nothing for an unlinked chat except try to redeem whatever text it's
  sent as a one-time linking code (`TELEGRAM_LINK_REQUESTED` in, 8 random chars, 5-minute TTL,
  single-use, `TELEGRAM_LINK_CREATED` out with a ready-to-open `t.me/<bot>?start=<code>` deep link
  — `apps/telegram` builds this itself via the Bot API's `getMe()`, so nothing else needs to know
  its username); once redeemed, that chat is permanently linked to the app user who requested the
  code (`telegram_links` table, one chat per user and vice versa). This is what keeps a publicly
  discoverable bot from being an open door onto Auth Service or onto other users' data — nothing
  reaches application code until a real app account has claimed the chat.
  Decoupled from every other service via Kafka once linked: any service publishes a
  `TelegramSendMessage` (plain text, or text + native inline-keyboard buttons) targeting a `userId`
  (omit it to broadcast to everyone linked) to `KAFKA_TOPICS.TELEGRAM_MESSAGE_SEND`; a button tap or
  typed reply comes back tagged with the sender's `userId` as a `TelegramReceivedMessage` on
  `KAFKA_TOPICS.TELEGRAM_MESSAGE_RECEIVED` for whichever feature is listening. No feature consumes
  either topic yet — generic plumbing, same status as Gateway's WS layer. See
  `docs/specs/event-schemas.md`.
- **Kafka** runs (`devops/kafka/docker-compose.yml`) — both `gateway` (link-code request/reply) and
  `telegram` (linking + message send/receive) produce and consume; `backend/libs/kafka-contracts`
  holds all four topics. No feature consumes the two message topics yet.

## First run

1. `cd devops/observability && docker compose up -d` (telemetry stack must exist first —
   `devops/docker-compose.yml` references its network as `external: true`).
2. `cd devops && cp .env.example .env` and set real values: `GATEWAY_PUBLIC_URL` to your PC's
   Tailscale MagicDNS name (port 8000 — this is what makes it reachable from your phone), and real
   random `JWT_SECRET`/`PASSWORD_PEPPER`.
3. `cd ../backend && cp .env.example .env` and set `TELEGRAM_BOT_TOKEN` (from `@BotFather`) — the
   `telegram` container crash-loops without it.
4. `cd ../devops && docker compose up -d --build`.
5. Open `http://localhost:8081` (or your Tailscale-reachable frontend origin) from your phone,
   register an account, log in. Each person then links their own Telegram chat from Settings: tap
   "Get linking code", then either tap "Open Telegram" (the app builds the deep link for you) or
   send the shown code to the bot manually — either way, within 5 minutes.

## Commands

Backend (run from `backend/`):
```bash
npm install
npx nest start gateway --watch     # or: auth, telegram
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
`kafka-client` (generic `IEventPublisher`/`IEventConsumer` and their `kafkajs`-backed
implementations), `kafka-contracts` (this project's own topics/message shapes — see
`docs/specs/event-schemas.md`).

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
- **`apps/telegram` never treats an unlinked chat as trusted input** — a Telegram bot's username is
  publicly discoverable, so any chat can message it; the *only* thing an unlinked chat's message
  can do is attempt to redeem a one-time linking code (`TelegramInboundService`). Nothing reaches
  Kafka's message topics, and no feature is invoked, until a chat is linked to a real app user.
  Don't bypass this to "simplify" a feature built on top of the Telegram channel.
- **Generating a Telegram linking code requires a valid access token** (`POST /telegram/link-code`,
  guarded by `JwtAuthGuard`) — it publishes a request for whichever user the token belongs to.
  Nothing about *redeeming* a code is authenticated (that's the point — it's what lets an
  unauthenticated Telegram chat prove it's a real app user), so the code itself is the only secret;
  keep it short-lived and single-use rather than loosening either.
- **The link-code round trip is entirely async (HTTP → Kafka → Kafka → WS), not request/response**
  — `POST /telegram/link-code` returns 202 immediately; the actual code is pushed to the caller's
  WS connection later (`TelegramLinkCreatedConsumer`), and is simply never delivered if they have
  no open connection at that moment (`pushToUser` returns `false`, not an error — see
  `docs/specs/architecture.md`'s linking sequence diagram). Don't add a synchronous path back onto
  this flow without reconsidering why it was made async in the first place.
