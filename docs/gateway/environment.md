# Gateway environment

Read from `backend/.env` locally (`npx nest start gateway`), or from `devops/docker.env` +
`devops/gateway/docker-compose.yml`'s `environment:` in Docker. See `backend/.env.example` for the
full variable list with defaults.

- **`PORT`** — deliberately not set in the shared `backend/.env`. Gateway defaults to `8000` in its
  own `main.ts` when unset. Every backend app shares that same file and defaults to its own port
  (users `8001`, reminders `8003`, notifications `8004`) — setting `PORT` in the
  shared file would force them all onto the same port and break the proxies. Docker gets `8000` published via `devops/gateway/docker-compose.yml`'s `ports:`.
- **`USERS_SERVICE_URL`**, **`REMINDERS_SERVICE_URL`**, **`NOTIFICATIONS_SERVICE_URL`** — where
  `PROXY_ROUTES` forwards (`/auth/*` and `/users/me*` → Users, `/reminders*` → Reminders,
  `/notifications/*` → Notifications), and where `GET /admin/status` asks each `/health`.
  `http://localhost:8001` / `8003` / `8004` locally; `http://users:8001` etc. in Docker (set in
  `devops/gateway/docker-compose.yml`'s `environment:`, since they need the Docker network
  hostnames, not `docker.env`'s shared values). Gateway fails fast at boot if any is unset.
- **`ADMIN_STATUS_TIMEOUT_MS`** — how long `GET /admin/status` waits for each `/health` before
  calling that service `down` (default `2000`).
- **`THROTTLE_TTL_MS` / `THROTTLE_LIMIT`** — global rate limit, all routes.
- **`AUTH_THROTTLE_TTL_MS` / `AUTH_THROTTLE_LIMIT`** — tighter limit specifically on
  `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/account` and `/realtime/device`.
- **`KAFKA_BROKERS`** — for `frontend.releases` (new app releases → `app-update` over `/ws`).
  `kafka:19092` in Docker (`devops/docker.env`); a local run needs a broker on `localhost:9092`.
- **`JWT_SECRET`** — must be byte-identical to the Users Service's copy (Users signs, Gateway verifies).
  In Docker this comes from `devops/.env` via an explicit `${JWT_SECRET}` in
  `devops/gateway/docker-compose.yml`'s `environment:`, not from `docker.env`.

See [docs/users/environment.md](../users/environment.md) for the Users Service side of `JWT_SECRET`,
and `docs/specs/architecture.md` for how `trust proxy`, the `127.0.0.1`-only port and the proxies
in front of Gateway interact with rate limiting.
