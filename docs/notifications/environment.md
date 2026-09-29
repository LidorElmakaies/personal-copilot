# Notification Service environment

Read from `backend/.env` locally (`npx nest start notifications`), or from `devops/docker.env` +
`devops/notifications/docker-compose.yml` in Docker.

- **`PORT`** — not set in the shared `backend/.env`; defaults to `8004` in `main.ts` (see
  [docs/gateway/environment.md](../gateway/environment.md) for why no app sets `PORT` there).
- **`NOTIFICATIONS_DATABASE_URL`** — this service's own database in the shared Postgres (`notifications`), created by
  `devops/postgres`'s `postgres-init`. Separate from Auth's `DATABASE_URL` so each service owns
  its tables.
- **`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`** — the server's Web Push identity (a P-256 key pair,
  base64url). Generate once with `npx web-push generate-vapid-keys` and keep them in `backend/.env`
  (gitignored; Docker picks it up via `common.yml`). Browsers subscribe against the public key, so
  **changing the pair invalidates every stored subscription**; users have to turn notifications on
  again. The service refuses to boot if any `VAPID_*` is unset.
- **`VAPID_SUBJECT`** — a `mailto:` or `https:` contact sent to the push service with each push.
  Defaults to a placeholder (`mailto:push@personal-copilot.invalid`) so no real address or host
  name goes to Google.
- **`OTEL_EXPORTER_OTLP_ENDPOINT`** — same as every backend app; see root `CLAUDE.md`.
