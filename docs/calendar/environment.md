# Calendar Service environment

Read from `backend/.env` locally (`npx nest start calendar`), or from `devops/docker.env` +
`devops/calendar/docker-compose.yml` in Docker.

- **`PORT`** — not set in the shared `backend/.env`; defaults to `8002` in `main.ts` (see
  [docs/gateway/environment.md](../gateway/environment.md) for why no app sets `PORT` there).
- **`OTEL_EXPORTER_OTLP_ENDPOINT`** — same as every backend app; see root `CLAUDE.md`.

No database and no secrets — the service is stateless. Candle-lighting minutes and Israel/abroad
rules are code constants (`application/shabbat.service.ts`), not configuration.
