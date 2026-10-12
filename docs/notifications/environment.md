# Notification Service environment

Read from `backend/.env` locally (`npx nest start notifications`), or from `devops/docker.env` +
`devops/notifications/docker-compose.yml` in Docker.

Shared by every backend app (OpenTelemetry): [docs/backend/environment.md](../backend/environment.md).

- **`PORT`** — not set in the shared `backend/.env`; defaults to `8004` in `main.ts` (see
  [docs/gateway/environment.md](../gateway/environment.md) for why no app sets `PORT` there).
- **`DATABASE_URL`** — the shared database (`personal_copilot`); this service uses the `notifications`
  schema (created by `devops/postgres`'s `postgres-init`) and writes only that.
- **`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`** — the server's Web Push identity (a P-256 key pair,
  base64url). Generate once with `npx web-push generate-vapid-keys` and keep them in `backend/.env`
  (gitignored; Docker picks it up via `common.yml`). Browsers subscribe against the public key, so
  **changing the pair invalidates every stored subscription**; users have to turn notifications on
  again. The service refuses to boot if any `VAPID_*` is unset.
- **`VAPID_SUBJECT`** — a `mailto:` or `https:` contact sent to the push service with each push.
  `backend/.env.example` ships a placeholder (`mailto:push@personal-copilot.invalid`) so no real
  address or host name goes to Google; it must still be set, there's no in-code default.
- **`FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY`** — the Firebase service-account key
  the Android (FCM) channel sends with: Firebase → Project settings → Service accounts → Generate
  new private key, then `project_id`, `client_email` and `private_key` from its JSON (the key on one
  line with `\n`, in double quotes). Secret — `backend/.env` only, never logged; shared between
  PCs with `scripts/secrets.js`. Optional: if any is unset the FCM channel is off (a warning at
  boot) and Android devices are stored but not sent to. Sending is an outbound call to
  `fcm.googleapis.com`; nothing is exposed. A lost or leaked key is replaced by generating a new one
  there (and deleting the old).
- **`REDIS_URL`** — the Redis holding the `notification-requested` BullMQ queue this service
  consumes (see `docs/specs/event-schemas.md`). `redis://redis:6379` in Docker
  (`devops/docker.env`). Redis isn't published to the host, so a local (non-Docker) run needs its
  own Redis on `localhost:6379`. Required at boot.
- **`NODE_ENV`** — anything but `production` lets TypeORM sync the `notifications` tables at boot (see
  `backend/apps/users/README.md`).
