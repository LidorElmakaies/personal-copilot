# Docker Compose environment layering

Three separate files feed the app stack (`devops/docker-compose.yml`), each with a different
scope — see `docs/specs/architecture.md#compose--build-layout` for the include/extends mechanics
behind this.

- **`backend/.env`** (gitignored) — the same file every backend app also reads for local
  (non-Docker) dev. Supplied to every backend container as `common.yml`'s base `env_file:`. See
  [docs/gateway/environment.md](../gateway/environment.md) and
  [docs/auth/environment.md](../auth/environment.md) for what's in it.
- **`devops/docker.env`** (checked into git — no secrets) — container-network overrides layered on
  top of `backend/.env` via each service's own `env_file:` list: `KAFKA_BROKERS`, `DATABASE_URL`,
  `OTEL_EXPORTER_OTLP_ENDPOINT`, all pointed at Docker service names instead of `localhost`.
- **`devops/.env`** (gitignored, copy of `devops/.env.example`) — read directly by `docker compose`
  when invoked from `devops/`. `GATEWAY_PUBLIC_URL` (baked into the frontend build — see
  [docs/frontend/environment.md](../frontend/environment.md)), plus `JWT_SECRET`/`PASSWORD_PEPPER`
  passed explicitly into Gateway's `environment:` so they're guaranteed to match `backend/.env`'s
  copy that Auth Service reads. Not shared with `devops/observability`'s compose project (a
  separate directory/compose project that doesn't need any of this).

Startup order matters: `devops/observability` first (the app stack's `docker-compose.yml`
references its network as `external: true`), then `devops`. See root `CLAUDE.md`'s "First run".
