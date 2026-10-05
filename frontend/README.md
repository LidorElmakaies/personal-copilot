# frontend

Expo/React Native app — optional login/register (the app doesn't gate itself on a session), a Home
tab (clock, dates, Shabbat times for the device's location, and a candle-lighting reminder bell),
and an auth-gated Account tab
(theme, notifications, email/password, profile, logout, delete account). See the root
[CLAUDE.md](../CLAUDE.md) for architecture, [.claude/agents/frontend.md](../.claude/agents/frontend.md)
for the conventions to follow when changing anything here.

```bash
npm install
cp .env.example .env    # sets EXPO_PUBLIC_GATEWAY_ORIGIN — required, no fallback
npx expo start          # Expo Go / dev client
npx expo start --web
```

On your phone over Tailscale (Expo Go): see `docs/frontend/environment.md` — run Expo on `:8082`
with `EXPO_PUBLIC_GATEWAY_ORIGIN` pointing at the PC's tailnet IP. Browser tests live in
[`e2e/`](e2e/README.md) (Playwright, runs in a container).

Matches the sibling project it's modeled on (`ask-my-crawl`) for theme/component conventions — the
same three-layer theme pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`, 600ms
transitions), minus the Gluestack layer underneath `ask-my-crawl`'s own pipeline — nothing here
renders an actual Gluestack component, so it wasn't carried over. The current look (space/glow/
gradient) is a known stepping-stone, expected to be replaced by a different, more animated style
later — keep it internally consistent until then rather than treating it as a fixed brand.

`src/components/` splits into `base/` (primitives, grouped into subfolders by purpose:
`background/` — `Meteors`, `Stars`; `buttons/` — `GradientButton`, `PillButton`; `feedback/` —
`Alert`, `Chip`, `VersionInfo`; `form/` — `InputField`, `SelectField`, `Stepper`, `Switch`; `layout/` —
`BottomSheet`, `GlowCard`, `Row`) and `composite/` (built from one or more base/composite
components — `AmbientBackground`, `CandleReminder`, `ConfirmModal`,
`NotificationsPrompt`, `ProfileFields`, `RequireAuthNotice`, `ShabbatSection`, and the Account
tab's `ThemeCard`, `NotificationsCard`, `AccountCard`, `ProfileCard`, `LogoutCard`, `DeleteAccountCard`). See `.claude/agents/frontend.md` for the classification rule when adding one.

Same Redux Toolkit + services-layer + Expo Router conventions otherwise: all I/O lives in
`src/services/`, split by transport — `services/http/` (fetch-based calls), `services/ws/` (the
Socket.IO client), and `services/device/` (on-device I/O: `expo-location`, the browser's push APIs) — called only from
thunks in `src/store/slices/`, never inline in a component.

## Version

`src/config/version.js` exposes the `app` and `frontend` versions and the build time, which
`Dockerfile` reads from `version/versions.json` into `EXPO_PUBLIC_*` vars (so `expo start` shows
"dev"); the Account tab's `VersionInfo` shows them. See `docs/specs/services.md#versions`.

## Location (`expo-location`)

`app.json` registers the `expo-location` config plugin with the iOS "when in use" permission text;
only foreground location is used. On web, the browser's geolocation API requires HTTPS (or
`localhost`) — that's why phone access goes through `tailscale serve` (root README, "Phone
access").

## Notifications (Web Push, web build only)

`public/sw.js` is the service worker; `expo export` copies `public/` to the export root, so it's
served at `/sw.js` with scope `/`. It needs a secure context like GPS does — on the phone that's
the `tailscale serve` HTTPS URL. Native builds report notifications as unsupported. Flow and state
rules: `docs/specs/services.md#frontend` and `docs/specs/notification-flow.md`.

## Phone numbers (`libphonenumber-js`)

The optional phone field (register, Account → Profile) is a country dropdown plus local digits;
`src/utils/phone.js` validates them with `libphonenumber-js` and converts to/from the E.164 form
the Users Service stores. Supported countries are `PHONE_COUNTRIES` — adding one is just a new
entry, the library already knows every numbering plan.

## Hebrew date (`@hebcal/hdate`)

The Home tab's Hebrew/Jewish date uses `@hebcal/hdate` rather than `Intl`'s `'he-u-ca-hebrew'`
calendar extension. The `Intl` approach works in a desktop browser, but Hermes (React Native's JS
engine) isn't guaranteed to ship non-Gregorian calendar tables in its bundled ICU data — the same
code can silently fall back to the Gregorian calendar on-device with no error. `@hebcal/hdate` is
pure JS with no ICU dependency, so it renders the same regardless of platform. Don't swap this back
to `Intl` to drop the dependency without re-verifying on-device (not just web) first.

## Caddy deployment (`Caddyfile`)

One Caddyfile serves two deployment modes via env-var placeholders (`{$VAR:default}`, Caddy's
native substitution) — see `docs/specs/architecture.md#system-topology` for the full topology and
`devops/frontend/docker-compose.yml` vs. `docker-compose.cloud.yml` for how each mode sets them.

- **Local/Tailscale** (default, no env overrides): `SITE_ADDRESS` is bare `:80` — a hostless
  address disables Caddy's automatic HTTPS entirely, since there's no domain to request a cert for.
  `GATEWAY_UPSTREAM` defaults to `gateway:8000` (Docker network DNS), but the `/auth/*`,
  `/calendar/*`, `/users/*`, `/reminders*`, `/notifications/*`, `/ws*` reverse-proxy blocks go unused in this mode — the browser calls Gateway's
  own Tailscale HTTPS URL directly, baked into the build at `GATEWAY_PUBLIC_URL`. HTTPS itself comes
  from `tailscale serve` in front of this container, not from Caddy.
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
