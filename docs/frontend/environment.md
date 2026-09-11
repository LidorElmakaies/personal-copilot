# Frontend environment

- **`EXPO_PUBLIC_GATEWAY_ORIGIN`** (`frontend/.env.example` → `frontend/.env`) — local
  (non-Docker) dev only. Expo inlines `EXPO_PUBLIC_*` vars into the client bundle automatically;
  `npx expo start` reads this file.
- **`GATEWAY_PUBLIC_URL`** (`devops/.env.example` → `devops/.env`) — the Dockerized build's
  equivalent, passed as a build `ARG` in `devops/frontend/docker-compose.yml` and baked into
  `EXPO_PUBLIC_GATEWAY_ORIGIN` inside the image (must be a build arg, not a runtime env var — the
  static web export has no server to read a runtime var from). Set this to your PC's Tailscale
  MagicDNS name, port 8000, so the phone-reachable build calls the right origin.

## Cloud deployment (Hetzner + Caddy, not yet live)

`devops/frontend/.env.cloud.example` → `devops/frontend/.env.cloud`, read by
`docker-compose.cloud.yml` only:

- **`DOMAIN`** — public domain Caddy provisions a Let's Encrypt cert for.
- **`GATEWAY_TUNNEL_PORT`** — loopback port on the VPS that the SSH reverse tunnel forwards to
  Gateway's `8000` on the home machine; Caddy proxies to `127.0.0.1:<this port>`.

See `docs/specs/architecture.md`'s "System topology" and "SSH reverse-tunnel hardening" sections.
