# Architecture

How the pieces in `docs/specs/services.md` fit together — diagrams plus the compose/build wiring
that doesn't fit one. See `services.md` for the per-service contract and `event-schemas.md` for the
queue, job and event contracts.

## System topology

Two access paths exist to reach Gateway. The Tailscale path is what actually runs today. The
cloud/Hetzner path is code that's in place in the repo (Gateway's rate limiting, `trust proxy`
handling, `frontend/Caddyfile`'s proxy blocks, `devops/frontend/docker-compose.cloud.yml`) to
support a planned deployment — the VPS itself isn't provisioned or live. Both are valid at once:
nothing about the Tailscale path changes, since `frontend/Caddyfile`'s `{$GATEWAY_UPSTREAM}` and
`{$SITE_ADDRESS}` placeholders default to exactly today's local behavior and are only overridden by
`docker-compose.cloud.yml`'s own env.

```mermaid
flowchart LR
    Phone(["Your phone (Tailscale)"])
    Browser(["Browser (public internet)"])

    subgraph Home["Home PC"]
        TsServe["tailscale serve\nHTTPS :443 / :8443"]
        Gateway["gateway\n:8000\n(+ /calendar/*, @app/jewish-calendar)"]
        FrontendLocal["frontend\n:8081 (Caddy, local mode;\n/apk/ registry)"]
        ApkRegistry[("devops/data/apk\nAPK registry: latest.json, APKs")]
        subgraph Docker["Docker network: personal-copilot"]
            Users["users"]
            Reminders["reminders\n(scheduler, @app/jewish-calendar)"]
            Notifications["notifications\n(Web Push, FCM)"]
            Postgres[("postgres\nDB personal_copilot, schemas:\nusers, reminders, notifications")]
            Redis[("redis\nBullMQ queues: notification-requested,\nreminder-due")]
            Kafka[("kafka\ntopics: users.user-state,\nfrontend.releases")]
        end
    end

    subgraph VPS["Hetzner VPS — planned, not yet deployed"]
        CaddyCloud["frontend\n:443 only (Caddy, cloud mode, auto-HTTPS)"]
    end

    Phone -->|HTTPS, over Tailscale| TsServe
    TsServe -->|":443 → :8081"| FrontendLocal
    TsServe -->|":8443 → :8000 (REST + WS)"| Gateway

    Browser -->|HTTPS| CaddyCloud
    CaddyCloud -->|"every Gateway route (@gateway) via SSH reverse tunnel"| Gateway

    FrontendLocal -->|"serves /apk/ (read-only)"| ApkRegistry
    Kafka -->|"frontend.releases → app-update over /ws\n(no client listens)"| Gateway
    Gateway -->|"HTTP (+ X-User-Id on /users/me*)"| Users
    Gateway -->|"HTTP + X-User-Id\n(not called by the app)"| Reminders
    Gateway -->|"HTTP + X-User-Id\n(not called by the app)"| Notifications
    Users --> Postgres
    Users -->|"outbox: users.user-state"| Kafka
    Reminders -->|"own schema + reads users.profiles"| Postgres
    Kafka -->|"users.user-state"| Reminders
    Reminders <-->|"reminder-due jobs;\nnotification-requested"| Redis
    Notifications --> Postgres
    Redis -->|"notification-requested jobs\n(progress saved back)"| Notifications
    Notifications -->|"encrypted push"| PushSvc(["Browser push service\n(FCM for Chrome/Brave)"])
    PushSvc -.-> Phone
    Notifications -->|"data-only, encrypted per device"| FcmApi(["FCM HTTP v1\nfcm.googleapis.com"])
    FcmApi -.->|"Android app"| Phone
```

Only `gateway` and `frontend` are reachable from outside the Docker network. Over Tailscale,
`frontend` is a container on the same Docker host as `gateway`, and `tailscale serve`
(`devops/tailscale/serve.js`) puts both behind HTTPS with the machine's `*.ts.net` certificate —
required because phone browsers only allow GPS on HTTPS pages. The frontend build calls Gateway at
that HTTPS `:8443` address directly (`GATEWAY_PUBLIC_URL`), not through the local Caddy; the Android
APK bakes in the same HTTPS address when set (Android blocks plain HTTP). Only the dormant
login/account screens call it — Home, Calendar, reminders and updates need no Gateway. Gateway's `:8000` is bound to
`127.0.0.1`, so nothing reaches it without going through `tailscale serve`. In the cloud path, `frontend`
(Caddy) instead runs standalone on the VPS and reaches `gateway` only via an SSH reverse tunnel
from the home machine (see "SSH reverse-tunnel hardening" below) — `gateway` itself is never given
a public port either way. `users`, `reminders`, and `notifications` are
internal-only; `users` publishes every profile change to Kafka (`users.user-state`, through
its outbox; Reminders consumes it); `reminders` stores the candle-lighting reminder and the
user's own reminders and fires each as a delayed BullMQ job (`reminder-due`), publishing
`notification-requested` — not called by the app, which keeps its reminders on the phone;
those already saved there keep firing. All calendar maths is the in-process `@app/jewish-calendar` library,
used by Reminders and by Gateway, which serves `GET /calendar/shabbat` and `GET /calendar/month`
itself — not called by the app, which computes both on the phone from its own copy
(`frontend/src/lib/jewish-calendar/`); `notifications` stores browsers' Web Push subscriptions and
Android FCM devices (the app registers none; those stored keep receiving), and processes `notification-requested` jobs from Redis, sending each to
every device the user has — through the browser's push service or FCM, end-to-end encrypted — and
retrying the job for devices that weren't reached (see `notification-flow.md`). Gateway's WS
(`/ws`) holds one connection per device (each app install has a device token from
`POST /realtime/device`; signed in or anonymous) and can push to every device of a user
(`IRealtimeConnectionService.pushToUser`) or broadcast to all; it broadcasts `app-update` when
`apk.js publish` announces a new release on Kafka (`frontend.releases`). The app opens no `/ws`
connection (`RealtimeConnectionManager` is dormant) and finds releases itself in the APK registry
(`devops/data/apk`), served by the frontend's Caddy at `/apk/`.

Gateway rate-limits globally (`@nestjs/throttler`, `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`) plus a
tighter per-route limit on `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/account` (both
methods) and `/realtime/device` (`AUTH_THROTTLE_TTL_MS`/`AUTH_THROTTLE_LIMIT`) — see `docs/specs/services.md#gateway`. The limiter
keys on client IP. Gateway's port is published on `127.0.0.1` only, so the only ways in are local
proxies: `tailscale serve` (phones) and the SSH tunnel's local end (cloud: Caddy → tunnel). Both
reach the container through Docker's bridge, never as the real client, and both set
`X-Forwarded-For`. `src/trust-proxy.ts`'s `TRUST_PROXY` (loopback + private networks) trusts exactly
those hops (Express's `trust proxy`), so the limiter sees the client's own IP — which also bounds
`/ws`, since each connection needs a device token from the rate-limited `POST /realtime/device`. Nothing can reach the port from outside the machine to send a forged
header — that's what makes the trust safe, so the port must stay bound to `127.0.0.1`.

## SSH reverse-tunnel hardening (Hetzner deployment)

Applies to the VPS's `sshd`. The home machine always initiates the connection outbound
(`ssh -R <GATEWAY_TUNNEL_PORT>:localhost:8000 <tunnel-user>@<vps>`, matching
`devops/frontend/.env.cloud.example`'s `GATEWAY_TUNNEL_PORT`), so the VPS is the server side of
this session and the side whose `sshd_config`/`authorized_keys` governs what the tunnel is allowed
to do. This is config to apply directly on the VPS, not something enforced by anything in this
repo.

- Use a dedicated SSH user and key for the tunnel only — not the operator's normal login key.
- Restrict that key's `authorized_keys` entry (or an equivalent `Match User <tunnel-user>` block in
  `sshd_config`):
  ```
  permitlisten="127.0.0.1:8000",permitopen="none",no-pty,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA...
  ```
  - `permitlisten="127.0.0.1:<port>"` is the directive that actually scopes a `-R` remote forward —
    it restricts which port this key can ask `sshd` to bind on the VPS to just Gateway's tunnel
    port. (`PermitOpen`/`permitopen` scopes `-L`/`-D` *local* forwarding's destination and has no
    effect on `-R`; set it to `"none"` alongside `permitlisten` so this key can't also be used to
    open a local/dynamic forward to something else on the VPS's own network.)
  - `no-pty,no-X11-forwarding,no-agent-forwarding` — the key can do nothing but the one forward: no
    shell, no X11, no agent access.
- `GatewayPorts no` (the `sshd` default — don't override it) is what keeps the forwarded port
  loopback-only on the VPS, reachable only by Caddy running on that same box, never directly from
  the open internet.

## Flow: register / login

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Gateway
    participant Users as users
    participant DB as Postgres

    User->>Frontend: submit email + password
    Frontend->>Gateway: POST /auth/login
    Gateway->>Users: forward (HTTP)
    Users->>DB: look up user, verify password hash
    Users-->>Gateway: { access_token, refresh_token }
    Gateway-->>Frontend: relay verbatim
    Frontend->>Frontend: decode access_token → user
```

## Flow: access token rejected (signed in)

Any signed-in call (only the dormant login/account screens make them); see `services.md#frontend`'s
"Staying signed in" and "Session ended". A call whose token has already expired renews before
sending, the same way.

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Gateway

    Frontend->>Gateway: e.g. GET /users/me (Bearer token)
    Gateway-->>Frontend: 401 (JwtAuthGuard rejects the token)
    alt token is still the current one
        Frontend->>Gateway: POST /auth/refresh { refresh_token } (one at a time, shared)
        alt new pair
            Gateway-->>Frontend: { access_token, refresh_token } (old one revoked)
            Frontend->>Gateway: GET /users/me again (new token) — once only
        else refused (400/401: revoked, 30 days unused)
            Frontend->>Frontend: clearAuth({ notice }) — signed out
            Note over Frontend: login screen shows "Your session ended — please log in again."
        else no answer (offline, 5xx)
            Frontend->>Frontend: keep the session, the call fails
        end
    else older token, same user (already renewed)
        Frontend->>Gateway: GET /users/me again (current token) — once only
    else signed out, or another user
        Frontend->>Frontend: the call fails
    end
```

## Flow: Shabbat times on Home

```mermaid
sequenceDiagram
    actor User
    participant App as Frontend (Home)
    participant GPS as Device location
    participant Lib as src/lib/jewish-calendar (on the phone)

    User->>App: open app
    App->>GPS: request permission + position (locate)
    App->>Lib: calendarService.getShabbat(last known location, if cached)
    GPS-->>App: { latitude, longitude }
    App->>Lib: calendarService.getShabbat(location)
    Lib->>Lib: today in Israel → Friday → city custom → @hebcal/core (Israel rules)
    Lib-->>App: { candleLighting, havdalah, parasha, holidays, isNow } (times as ISO strings)
    App->>App: countdown + "in progress" from the device clock
    Note over App: after Havdalah passes → compute again for next Shabbat. No network.
```

## Flow: month on the Calendar tab

```mermaid
sequenceDiagram
    actor User
    participant App as Frontend (Calendar)
    participant Lib as src/lib/jewish-calendar (on the phone)

    User->>App: open Calendar tab
    opt no location asked for yet (opened straight to this tab)
        App->>App: locate
    end
    App->>Lib: calendarService.getMonth(location, year, month) (device's current month)
    Lib->>Lib: each day's Hebrew date, events, times
    Lib-->>App: { year, month, days } (times as ISO strings)
    App->>App: MonthGrid
    App->>Lib: getMonth for the month either side (preload)
    User->>App: swipe, or ‹ ›
    App->>Lib: getMonth for any month within two of it not loaded yet
    Note over App: months kept per place (~1 km), pruned to those near the month shown
```

## Flow: location sync (signed in; dormant)

`LocationSyncManager` isn't mounted by `app/_layout.js`, so this runs only if it's mounted again.

```mermaid
sequenceDiagram
    participant GPS as Device location
    participant App as Frontend (LocationSyncManager)
    participant Gateway
    participant Users as users
    participant DB as Postgres
    participant Kafka

    GPS-->>App: fresh fix (location.status = 'ready')
    opt profile not loaded yet
        App->>Gateway: GET /users/me
        Gateway->>Users: forward + X-User-Id
        Users-->>App: profile (incl. saved location)
    end
    App->>App: moved > 5 km from the saved location?
    alt yes
        App->>Gateway: PUT /users/me/location { lat, lon }
        Gateway->>Users: forward + X-User-Id
        Users->>DB: update profile + outbox row (one transaction)
        Users-->>App: updated profile
        Users--)Kafka: OutboxRelay publishes users.user-state
    else no
        Note over App: nothing sent
    end
```

## Flow: setting the candle-lighting reminder

Kept on the phone (`remindersSlice`, `candles` persisted) and fired as a local notification;
no network, no login. Planner and triggers: `services.md#frontend`'s "Reminder notifications".

```mermaid
sequenceDiagram
    actor User
    participant App as Frontend (Home, CandleReminder)
    participant Store as Redux (reminders, persisted)

    Store-->>App: candles { enabled, offsetMinutes } (offset 90 until saved)
    User->>App: bell → sheet → pick offset
    App->>App: "fires at" = Home's candle lighting − offset
    User->>App: Save
    App->>Store: saveCandleReminder(offset)
    Store-->>App: { enabled: true, offsetMinutes }
    App->>App: bell turns amber, sheet closes
    opt Turn off
        App->>Store: turnOffCandleReminder → enabled false (offset kept)
    end
    Store->>Store: reconcileReminderNotifications (see "reminder notifications" below)
```

## Flow: your own reminders on the Calendar tab

Kept on the phone (`customRemindersSlice`, `items` persisted); no network, no login. The sheet's choices:
`services.md#frontend`. Fired as local notifications, as in the candle-lighting flow.

```mermaid
sequenceDiagram
    actor User
    participant App as Frontend (Calendar, CustomReminderSheet)
    participant Store as Redux (customReminders, items persisted)
    participant Lib as src/lib/jewish-calendar (on the phone)

    App->>Store: setRemindersRange(month shown ± 1), on every month change
    Store->>Lib: selectDayReminders: each definition's days in range (cached per definition)
    Lib-->>App: { date: [rows] } → per-day counts on the grid, rows on DayCard
    User->>App: + (or tap a row) → sheet
    App->>Lib: nextDates(timing) as the timing changes → "Next" (up to 3 dates)
    User->>App: Save
    alt new, or "Every time"
        App->>Store: createCustomReminder / updateCustomReminder (checked, then one action)
    else "Only <day>" on a repeating one
        App->>Store: editCustomReminderDay: changed[day] = { title, hour, minute }, in place
    end
    alt a problem (title, limits, day it doesn't fall on, …)
        Store-->>App: rejected with the message, sheet stays open
    else saved
        App->>App: days recomputed for the changed definition, sheet closes
        Store->>Store: reconcileReminderNotifications (see "reminder notifications" below)
    end
```

## Flow: reminder notifications on the phone (Android)

```mermaid
sequenceDiagram
    actor User
    participant Mgr as ReminderScheduleManager / a reminder thunk
    participant Rec as reconcileReminderNotifications
    participant Plan as schedulePlan (+ src/lib/jewish-calendar)
    participant LN as localNotificationsService (expo-notifications)
    participant Android

    Mgr->>Android: registerBackgroundReconcile (task reminder-notifications, ~daily)
    Mgr->>LN: initNotifications: ensureChannel + getPermission (start, foreground)
    opt permission default — NotificationsPrompt (once a reminder exists) or the reminder sheet's Turn on
        User->>Android: allow notifications (requestPermission)
    end
    Mgr->>Rec: on start, foreground, a move of ~1 km (placeOf), or after a change
    Android->>Rec: ~every 24 h while online, app closed or swiped away (WorkManager)
    Rec->>LN: ensureChannel ("Reminders")
    Rec->>Plan: planFor(state, now): 30 days + each one's next, at most 100
    Plan-->>Rec: [{ id, at, title, body, url }]
    Rec->>LN: listScheduled (ours: rem: ids)
    Rec->>LN: cancel ours not planned or changed, schedule the missing
    LN->>Android: exact alarms (re-armed after reboot or update)
    Android-->>User: notification at its time (app closed or not)
    User->>Android: tap
    Android-->>Mgr: watchTaps → data.url
    Mgr->>Mgr: router.navigate("/" or "/calendar")
```

## Flow: Android app update

Android APK only, no login, no Gateway. The registry is static files the frontend's Caddy serves
at `/apk/`, written by `apk.js publish`.

```mermaid
sequenceDiagram
    actor User
    participant App as Android app (AppUpdateManager, UpdateSheet)
    participant Reg as frontend Caddy /apk/
    participant Android as Android installer

    App->>App: on start: delete cached APKs at or below the installed versionCode
    App->>Reg: GET latest.json (on start, on return to foreground)
    Reg-->>App: { version, versionCode, url, notes }
    alt versionCode > installed
        App->>App: UpdateSheet opens (once per version), UpdateChip on Home
        User->>App: Update
        App->>Reg: GET the APK → cache/updates/(versionCode).part, progress + Cancel
        App->>App: rename to .apk (status ready)
        App->>Android: ACTION_VIEW content:// URI
        Android-->>User: install screen (first time: allow installs from this app)
    end
```

## Compose & build layout

`devops/docker-compose.yml` only lists what to `include:` (one `devops/<unit>/docker-compose.yml`
per service — `gateway`, `users`, `reminders`, `notifications`, `frontend`, `postgres`,
`redis`, `kafka` today) plus the shared `networks:`.
Adding a service means a new Dockerfile under `backend/apps/<service>/` (or `frontend/`), a new
`devops/<service>/docker-compose.yml`, and one more `include:` line — see
`.claude/agents/devops.md` for the full shape.

Restart policy, logging, and `env_file` live once in `devops/common.yml`'s `_defaults` service,
applied per-service via `extends:` (YAML anchors don't resolve across the split files, so that's not
an option here). `networks:` stays out of `common.yml` and per-service instead, since the Nest services need
`[personal-copilot, observability]` (they export telemetry) while `frontend`, `postgres`,
`redis` and `kafka` need just `[personal-copilot]`.
Two `env_file` layers apply in order: `backend/.env` (local-dev defaults, the shared base) then
`devops/docker.env` (container-network overrides) — later entries win.

**Postgres**: one instance, one database (`personal_copilot`, `POSTGRES_DB`), one schema per
table-owning service — `users`, `reminders`, `notifications`. Every service connects with the same
`DATABASE_URL` and sets its own `schema`; it writes only that schema and may read another's tables
through a read-only TypeORM mapping (`synchronize: false`), e.g. Reminders reading
`users.profiles`. Ownership is a convention, not database roles. Tables that hold per-user data
reference `users.users(id)` `ON DELETE CASCADE`, so deleting an account removes them in the same
transaction — which is why `reminders` and `notifications` wait for `users` to be healthy (its
tables must exist first). `devops/postgres`'s `postgres-init` is a one-shot container that creates
any missing schema on every `up` (idempotent; Postgres's own first-boot init scripts can't, once
`devops/data/postgres` exists). Adding a service with tables = add its schema there.

`devops/docker-compose.yml`'s `observability` network is declared `external: true` — the telemetry
stack (`devops/observability/`) owns it and must already be running, or `docker compose up` here
fails outright ("network observability not found"). See root `CLAUDE.md`'s "First run" for the
required startup order.

**Frontend build**: `frontend/Dockerfile` builds only the static web export (served by Caddy).
The Android app is built separately, not by compose: `node devops/android/apk.js build` builds
`devops/android/Dockerfile` (JDK 17, Android SDK command-line tools, Node 22) and runs `apk.js`
itself inside it (`devops/android` mounted read-only at `/tools`) over a read-only
`frontend/` mount, with Docker volumes caching the SDK (`pc-android-sdk`), Gradle
(`pc-android-gradle`) and npm, and the release key plus the built APKs in `devops/data/android/`.
It sets the same `EXPO_PUBLIC_*` values the web image does, from `devops/.env` and
`version/versions.json` (`GATEWAY_PUBLIC_URL` optional, HTTPS when set), plus
`EXPO_PUBLIC_APK_REGISTRY_URL` — where the app checks for updates: `APK_REGISTRY_URL` (env or
`devops/.env`), else `https://<GATEWAY_PUBLIC_URL's host>/apk/`, the frontend's address as
`devops/tailscale/serve.js` publishes it; it refuses to build when neither is set. arm64 by default (`ANDROID_ABIS=arm64-v8a,x86_64` → an `-emulator` APK).
`node devops/android/apk.js publish` copies a built APK into `devops/data/apk/` — directly, or via
a `node:22-alpine` container when that folder is root-owned — which `frontend`'s Caddy serves at
`/apk/` (local mode only — see `frontend/README.md`).
`GATEWAY_PUBLIC_URL` must reach it as a Docker build `ARG` (`devops/frontend/docker-compose.yml`),
never a runtime container env var — Expo inlines `EXPO_PUBLIC_*` vars into the client bundle at
build time, so a runtime-only value would silently never reach the client.

**Version build context**: every image's `build:` (the four backend services, `frontend`, and
`docker-compose.cloud.yml`) adds `additional_contexts: version: ../../version` — just the repo's
`version/` folder, not the whole repo as context. Each backend Dockerfile extracts only its own
entry in a separate `own-version` stage, so bumping one service's version leaves every other
image's layers — and its baked-in build time — cached. The frontend reads its own `frontend` entry
from it into an `EXPO_PUBLIC_*` var at build time. A standalone `docker build` must pass
`--build-context version=../version`. What the versions are and where they're shown:
`services.md#versions`.

**Cloud frontend (Hetzner)**: `devops/frontend/docker-compose.cloud.yml` is a standalone compose
file, not part of `devops/docker-compose.yml`'s `include:` list and not deployed by the "First run"
sequence — it's built and run independently on the VPS itself (`devops/frontend/.env.cloud.example`
→ `.env.cloud`). `DOMAIN` feeds both `GATEWAY_PUBLIC_URL` (build arg, same as above) and
`SITE_ADDRESS` (runtime, flips `frontend/Caddyfile` into automatic Let's Encrypt HTTPS instead of
plain `:80`). `network_mode: host` so Caddy can reach the SSH tunnel's loopback port on that VPS;
`GATEWAY_TUNNEL_PORT` feeds `GATEWAY_UPSTREAM=127.0.0.1:<port>`. A persistent `caddy-data` volume
holds the issued certificate.

**Redis**: `redis:7.4-alpine`, single node, holds only BullMQ queues (see `event-schemas.md`). Not
published to the host. AOF (`appendfsync everysec`) with RDB snapshots off, data in
`devops/data/redis`, so queued and delayed jobs survive a restart. `maxmemory 64mb` with
`noeviction`, which BullMQ requires: a full Redis rejects new jobs (the publisher gets an error)
instead of silently evicting queue keys. `notifications` waits on its healthcheck
(`service_healthy`). The opt-in Redis tests run against a throwaway Redis
of their own (see CLAUDE.md's Commands) — this one isn't reachable from outside Docker, and they
empty the queues they use.

**Kafka**: `apache/kafka:4.3.1`, one node in KRaft mode (broker and controller in one, no
ZooKeeper), holds only events (see `event-schemas.md`). Not published to the host: it has no
authentication, and a published port would be reachable over Tailscale. One listener,
`kafka:19092` (`KAFKA_BROKERS` in `docker.env`). Data in `devops/data/kafka`, which must be owned by
the container's user or the broker crash-loops. `CLUSTER_ID` is fixed so the
existing data directory stays valid across recreations. Auto-create is off: the one-shot
`kafka-init` creates every topic in `KAFKA_TOPICS` (idempotent, 3 partitions each,
`users.user-state` compacted). The opt-in round-trip test needs a broker of its own on the host
(`KAFKA_IT_BROKERS=localhost:9092 npx jest kafka-roundtrip`).

