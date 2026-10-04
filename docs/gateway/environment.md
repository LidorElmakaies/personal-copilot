# Gateway environment

Read from `backend/.env` locally (`npx nest start gateway`), or from `devops/docker.env` +
`devops/gateway/docker-compose.yml`'s `environment:` in Docker. See `backend/.env.example` for the
full variable list with defaults.

- **`PORT`** — deliberately not set in the shared `backend/.env`. Gateway defaults to `8000` in its
  own `main.ts` when unset. Every backend app shares that same file and defaults to its own port
  (users `8001`, reminders `8003`, notifications `8004`) — setting `PORT` in the
  shared file would force them all onto the same port and break the proxies. Docker gets `8000` published via `devops/gateway/docker-compose.yml`'s `ports:`.
- **`USERS_SERVICE_URL`** — internal-only proxy target for `/auth/*`. `http://localhost:8001`
  locally; `http://users:8001` in Docker (set via `devops/gateway/docker-compose.yml`'s
  `environment:`, since it needs the Docker network hostname, not `docker.env`'s shared value).
- **`NOTIFICATIONS_SERVICE_URL`** — proxy target for `/notifications/*`. `http://localhost:8004`
  locally; `http://notifications:8004` in Docker (same override).
- **`REMINDERS_SERVICE_URL`** — proxy target for `/reminders/*` and `/calendar/*`. `http://localhost:8003` locally;
  `http://reminders:8003` in Docker (same override). Gateway fails fast at boot if any service URL
  is unset.
- **`THROTTLE_TTL_MS` / `THROTTLE_LIMIT`** — global rate limit, all routes.
- **`AUTH_THROTTLE_TTL_MS` / `AUTH_THROTTLE_LIMIT`** — tighter limit specifically on
  `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/account`.
- **`JWT_SECRET`** — must be byte-identical to the Users Service's copy (Users signs, Gateway verifies).
  In Docker this comes from `devops/.env` via an explicit `${JWT_SECRET}` in
  `devops/gateway/docker-compose.yml`'s `environment:`, not from `docker.env`.

See [docs/users/environment.md](../users/environment.md) for the Users Service side of `JWT_SECRET`,
and `docs/specs/architecture.md` for how `trust proxy` and the SSH-tunnel deployment interact with
rate limiting.
