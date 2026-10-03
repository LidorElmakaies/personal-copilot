# Reminders Service environment

Read from `backend/.env` locally (`npx nest start reminders`), or from `devops/docker.env` +
`devops/reminders/docker-compose.yml` in Docker.

- **`PORT`** — not set in the shared `backend/.env`; defaults to `8003` in `main.ts` (see
  [docs/gateway/environment.md](../gateway/environment.md) for why no app sets `PORT` there).
- **`DATABASE_URL`** — the shared database (`personal_copilot`); this service uses the `reminders`
  schema (created by `devops/postgres`'s `postgres-init`) and writes only that.
- **`OTEL_EXPORTER_OTLP_ENDPOINT`** — same as every backend app; see root `CLAUDE.md`.
