# Docker Compose environment layering

Three separate files feed the app stack (`devops/docker-compose.yml`), each with a different
scope — see `docs/specs/architecture.md#compose--build-layout` for the include/extends mechanics
behind this.

- **`backend/.env`** (gitignored) — the same file every backend app also reads for local
  (non-Docker) dev. Supplied to every backend container as `common.yml`'s base `env_file:` (`apk`
  resets it to none), so the `backend` profile needs it, copied from `backend/.env.example`. See
  each app's page — [gateway](../gateway/environment.md), [users](../users/environment.md) — and
  [docs/backend/environment.md](../backend/environment.md) for what's in it.
- **`devops/docker.env`** (checked into git — no secrets) — container-network overrides layered on
  top of `backend/.env` via each backend service's own `env_file:` list: `DATABASE_URL` (one
  database, a schema each) and `OTEL_EXPORTER_OTLP_ENDPOINT`, pointed at Docker service names
  instead of `localhost`.
- **`devops/.env`** (gitignored, copy of `devops/.env.example`) — read directly by `docker compose`
  when invoked from `devops/`: `JWT_SECRET`, passed explicitly into Gateway's `environment:` — it
  must match `backend/.env`'s copy, which the Users Service signs with. `node devops/android/apk.js
  build` also reads it (an env var of the same name wins): `APK_REGISTRY_URL` — where the APK
  checks for updates, default `https://<GATEWAY_PUBLIC_URL's host>/apk/`; the build refuses when
  neither is set — and `GATEWAY_PUBLIC_URL`, baked in as `EXPO_PUBLIC_GATEWAY_ORIGIN`: optional
  (only the hidden login/account screens call Gateway), HTTPS when set — the `:8443` URL
  `devops/tailscale/serve.js` prints. `scripts/secrets.js` keeps both URLs per PC. Not shared with
  `devops/observability`'s compose project (a separate directory/compose project that doesn't need
  any of this).

Startup order: `docker compose up -d` (only `apk`) needs nothing else running. For
`--profile backend`, `devops/observability` first (the backend services join its network, declared
`external: true`). See root `CLAUDE.md`'s "First run".
