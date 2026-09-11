# frontend

Expo/React Native app — login/register + a Settings tab. See the root
[CLAUDE.md](../CLAUDE.md) for architecture, [.claude/agents/frontend.md](../.claude/agents/frontend.md)
for the conventions to follow when changing anything here.

```bash
npm install
cp .env.example .env    # sets EXPO_PUBLIC_GATEWAY_ORIGIN — required, no fallback
npx expo start          # Expo Go / dev client
npx expo start --web
```

Matches the sibling project it's modeled on (`ask-my-crawl`) for theme/component conventions — the
same three-layer theme pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`, 600ms
transitions) and the same shared components (`GlowCard`, `GradientButton`, `InputField`,
`SpaceBackground`), minus the Gluestack layer underneath `ask-my-crawl`'s own pipeline — nothing
here renders an actual Gluestack component, so it wasn't carried over. The current look
(space/glow/gradient) is a known stepping-stone, expected to be replaced by a different, more
animated style later — keep it internally consistent until then rather than treating it as a fixed
brand.

Same Redux Toolkit + services-layer + Expo Router conventions otherwise: all I/O lives in
`src/services/`, split by transport — `services/http/` (fetch-based calls) and `services/ws/` (the
Socket.IO client) — called only from thunks in `src/store/slices/`, never inline in a component.

## Caddy deployment (`Caddyfile`)

One Caddyfile serves two deployment modes via env-var placeholders (`{$VAR:default}`, Caddy's
native substitution) — see `docs/specs/architecture.md#system-topology` for the full topology and
`devops/frontend/docker-compose.yml` vs. `docker-compose.cloud.yml` for how each mode sets them.

- **Local/Tailscale** (default, no env overrides): `SITE_ADDRESS` is bare `:80` — a hostless
  address disables Caddy's automatic HTTPS entirely, since there's no domain to request a cert for.
  `GATEWAY_UPSTREAM` defaults to `gateway:8000` (Docker network DNS), but the `/auth/*`/`/ws*`
  reverse-proxy blocks go unused in this mode — the browser calls Gateway's own Tailscale URL
  directly, baked into the build at `GATEWAY_PUBLIC_URL`.
- **Cloud/Hetzner**: `docker-compose.cloud.yml` overrides `SITE_ADDRESS` to a real domain, which
  flips on Caddy's automatic Let's Encrypt HTTPS, and `GATEWAY_UPSTREAM` to the SSH tunnel's
  loopback port. `GATEWAY_PUBLIC_URL` is built as the same domain, so the browser calls same-origin
  and Caddy's proxy blocks do the real work of reaching Gateway back on the home machine.

**No port 80, ever, in cloud mode** — this took two separate settings, not one:
- `auto_https disable_redirects` (global option) stops Caddy's default behavior of opening a `:80`
  listener purely to redirect HTTP to HTTPS.
- `tls { issuer acme { disable_http_challenge } }` (site option) stops Caddy from using the
  default HTTP-01 ACME challenge to issue/renew the certificate — that challenge needs port 80 too.
  Disabling it makes Caddy fall back to TLS-ALPN-01, which validates entirely over 443.

Both are inert in local mode: a bare `:80` site address never attempts TLS or ACME at all, with or
without these settings.
