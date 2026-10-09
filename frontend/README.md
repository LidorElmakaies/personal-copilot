# frontend

Expo/React Native app — optional login/register (the app doesn't gate itself on a session), a Home
tab (clock, dates, Shabbat times for the device's location, and a candle-lighting reminder bell),
an auth-gated Account tab (theme, notifications, email/password, profile, logout, delete account),
and an Admin tab of service status that only admins see. See the root
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
same theme pipeline (`themeSlice` → `useAppTheme()`; `AmbientBackground` cross-fades its two
backdrops in 600ms on a switch), minus the Gluestack layer underneath `ask-my-crawl`'s own pipeline — nothing here
renders an actual Gluestack component, so it wasn't carried over. The current look (space/glow/
gradient) is a known stepping-stone, expected to be replaced by a different, more animated style
later — keep it internally consistent until then rather than treating it as a fixed brand.

`src/components/` splits into `base/` (primitives, grouped into subfolders by purpose:
`background/` — `Meteors`, `Stars`; `buttons/` — `GradientButton`, `PillButton`; `feedback/` —
`Alert`, `VersionInfo`; `form/` — `InputField`, `SelectField`, `Stepper`, `Switch`; `layout/` —
`BottomSheet`, `GlowCard`, `Row`) and `composite/` (built from one or more base/composite
components — `AmbientBackground`, `CandleReminder`, `ConfirmModal`,
`FormActions`, `NotificationsPrompt`, `ProfileFields`, `RequireAuthNotice`, `ShabbatSection`, `SystemStatus`, `UpdateChip`, `UpdateSheet`, and the Account
tab's `ThemeCard`, `NotificationsCard`, `AccountCard`, `ProfileCard`, `LogoutCard`, `DeleteAccountCard`). See `.claude/agents/frontend.md` for the classification rule when adding one.

Same Redux Toolkit + services-layer + Expo Router conventions otherwise: all I/O lives in
`src/services/`, split by transport — `services/http/` (fetch-based calls), `services/ws/` (the
Socket.IO client), and `services/device/` (on-device I/O: `expo-location`, the browser's push APIs) — called only from
thunks in `src/store/slices/`, never inline in a component.

## Version

`src/config/version.js` exposes the frontend's version and build time, which `Dockerfile` (and
`apk.js build`) reads from `version/versions.json` into `EXPO_PUBLIC_*` vars (so `expo start` shows
"dev"); the Account tab's `VersionInfo` shows them. See `docs/specs/services.md#versions`.

## Android app

`node devops/android/apk.js build` builds the release APK in Docker (`expo prebuild --platform
android`, then Gradle) — see the root README. `app.json` holds the Android identity
(`com.lidor.personalcopilot`, which must never change, plus the permissions —
`REQUEST_INSTALL_PACKAGES` is for the in-app update); `app.config.js` adds the version and
Android's `versionCode`, both from `FRONTEND_VERSION`, which the build script sets (unset for the
web build and `expo start`). `src/utils/versionCode.js` is the one `versionCode()` — CommonJS,
since `app.config.js` and `devops/android/apk.js` load it in plain Node; the app uses it too, on
the baked `EXPO_PUBLIC_FRONTEND_VERSION`, to compare itself with the registry's `latest.json`.
The build also bakes `EXPO_PUBLIC_APK_REGISTRY_URL` (`URLS.apkRegistry`), where that check looks;
the web build never checks. Update APKs download to the app's cache (`updates/<versionCode>.apk`,
via a `.part` file) and are deleted once installed — see `docs/specs/services.md#frontend`. `plugins/withReleaseSigning.js` switches
the generated `android/app/build.gradle` from debug to release signing, with the key taken from env
vars only the build sets. `react-native-worklets` is a direct dependency so Reanimated 4's native
part links. `android/` is generated and git-ignored.

## App icon

One source, `assets/icon/icon.svg`, on Android's 108×108 adaptive-icon canvas with two layers
(`#background`, `#foreground`). `node devops/icons/render.js` renders every PNG from it in the
pinned Playwright image: the Android adaptive layers, `icon.png`, the splash image
(`expo-splash-screen` plugin in `app.json`), the favicon (`web.favicon`) and the web set in
`public/icons/`. Edit the SVG, re-run the script, rebuild. Keep anything that matters inside the
66px safe circle: launchers show only the middle 72px, masked.

## Location (`expo-location`)

`app.json` registers the `expo-location` config plugin with the iOS "when in use" permission text;
only foreground location is used. On web, the browser's geolocation API requires HTTPS (or
`localhost`) — that's why phone access goes through `tailscale serve` (root README, "Phone
access").

## Notifications (Web Push, web build only)

`public/sw.js` is the service worker; `expo export` copies `public/` to the export root, so it's
served at `/sw.js` with scope `/`. It needs a secure context like GPS does — on the phone that's
the `tailscale serve` HTTPS URL. Native builds report notifications as unsupported (the Android app's Notifications card and the
reminder sheet say they're coming soon). Flow and state
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
  `GATEWAY_UPSTREAM` defaults to `gateway:8000` (Docker network DNS), but the `@gateway`
  reverse proxy (every Gateway route) goes unused in this mode — the browser calls Gateway's
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

**`/apk/` — the APK registry.** Local mode only: `devops/frontend/docker-compose.yml` mounts
`devops/data/apk` read-only at `/apk`, and Caddy serves it there (page and `latest.json` never
cached, `.apk` with Android's installer content type). Nothing is mounted in cloud mode, so the
same block just 404s.
`node devops/android/apk.js publish` writes it (directly, or via a Node container when `devops/data/apk` is root-owned):
every published APK, `releases.json` (each version's `version`, `versionCode`, `file`, `sha256`,
`size`, `publishedAt`, `notes`), `latest.json` (`{version, versionCode, url: "/apk/<file>", sha256,
notes, publishedAt}` for the newest release — never a `-test.N` build; absent until there is one;
the installed app's update check reads it)
and `index.html`, a static download page: every version newest first, light/dark via
`prefers-color-scheme`, the icon inlined from `assets/icon/icon.svg`, times in the phone's local
time. Versions sort by `src/utils/versionCode.js`'s `versionCode()`. A published version's file
never changes — publishing a different one under it fails.
