# Reminders Service environment

Read from `backend/.env` locally (`npx nest start reminders`), or from `devops/docker.env` +
`devops/reminders/docker-compose.yml` in Docker.

- **`PORT`** — not set in the shared `backend/.env`; defaults to `8003` in `main.ts` (see
  [docs/gateway/environment.md](../gateway/environment.md) for why no app sets `PORT` there).
- **`REMINDERS_DATABASE_URL`** — this service's own database in the shared Postgres (`reminders`), created by
  `devops/postgres`'s `postgres-init`. Separate from Auth's `DATABASE_URL` so each service owns
  its tables.
- **`OTEL_EXPORTER_OTLP_ENDPOINT`** — same as every backend app; see root `CLAUDE.md`.
