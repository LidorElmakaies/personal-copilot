# Notification Service environment

Read from `backend/.env` locally (`npx nest start notifications`), or from `devops/docker.env` +
`devops/notifications/docker-compose.yml` in Docker.

- **`PORT`** — not set in the shared `backend/.env`; defaults to `8004` in `main.ts` (see
  [docs/gateway/environment.md](../gateway/environment.md) for why no app sets `PORT` there).
- **`NOTIFICATIONS_DATABASE_URL`** — this service's own database in the shared Postgres (`notifications`), created by
  `devops/postgres`'s `postgres-init`. Separate from Auth's `DATABASE_URL` so each service owns
  its tables.
- **`OTEL_EXPORTER_OTLP_ENDPOINT`** — same as every backend app; see root `CLAUDE.md`.
