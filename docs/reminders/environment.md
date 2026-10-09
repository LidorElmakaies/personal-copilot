# Reminders Service environment

Read from `backend/.env` locally (`npx nest start reminders`), or from `devops/docker.env` +
`devops/reminders/docker-compose.yml` in Docker.

- **`PORT`** — not set in the shared `backend/.env`; defaults to `8003` in `main.ts` (see
  [docs/gateway/environment.md](../gateway/environment.md) for why no app sets `PORT` there).
- **`DATABASE_URL`** — the shared database (`personal_copilot`); this service uses the `reminders`
  schema (created by `devops/postgres`'s `postgres-init`) and writes only that.
- **`REDIS_URL`** — the Redis holding its delayed `reminder-due` jobs and the
  `notification-requested` queue it publishes to. `redis://redis:6379` in Docker
  (`devops/docker.env`); a local run needs its own Redis on `localhost:6379`. Required at boot.
- **`KAFKA_BROKERS`** — for `users.user-state` (a profile change reschedules that user's reminders).
  `kafka:19092` in Docker (`devops/docker.env`); a local run needs a broker on `localhost:9092`.
- **`NODE_ENV`** — anything but `production` lets TypeORM sync the `reminders` tables at boot (see
  `backend/apps/users/README.md`).
- **`OTEL_EXPORTER_OTLP_ENDPOINT`** — same as every backend app; see root `CLAUDE.md`.
