# Gateway environment

Read from `backend/.env` locally (`npx nest start gateway`), or from `devops/docker.env` +
`devops/gateway/docker-compose.yml`'s `environment:` in Docker. See `backend/.env.example` for the
full variable list with defaults.

- **`PORT`** — deliberately not set in the shared `backend/.env`. Gateway defaults to `8000` in its
  own `main.ts` when unset. Auth Service shares that same file and defaults to a different port
  (`8001`) — setting `PORT` in the shared file would force both onto the same port and break the
  proxy. Docker gets `8000` published via `devops/gateway/docker-compose.yml`'s `ports:`.
- **`AUTH_SERVICE_URL`** — internal-only proxy target for `/auth/*`. `http://localhost:8001`
  locally; `http://auth:8001` in Docker (set via `devops/gateway/docker-compose.yml`'s
  `environment:`, since it needs the Docker network hostname, not `docker.env`'s shared value).
- **`THROTTLE_TTL_MS` / `THROTTLE_LIMIT`** — global rate limit, all routes.
- **`AUTH_THROTTLE_TTL_MS` / `AUTH_THROTTLE_LIMIT`** — tighter limit specifically on
  `/auth/register`, `/auth/login`, `/auth/refresh`.
- **`JWT_SECRET`** — must be byte-identical to Auth Service's copy (Auth signs, Gateway verifies).
  In Docker this comes from `devops/.env` via an explicit `${JWT_SECRET}` in
  `devops/gateway/docker-compose.yml`'s `environment:`, not from `docker.env`.

See [docs/auth/environment.md](../auth/environment.md) for the Auth Service side of `JWT_SECRET`,
and `docs/specs/architecture.md` for how `trust proxy` and the SSH-tunnel deployment interact with
rate limiting.
