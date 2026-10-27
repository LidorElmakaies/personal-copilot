# frontend

Expo/React Native app, built as an Android APK — optional login/register (the app doesn't gate itself on a session), a Home
tab (clock, dates, Shabbat times for the device's location, and a candle-lighting reminder bell),
a Calendar tab (the Jewish-calendar month; the user's own reminders on it, added and
edited in a bottom sheet — both kinds of reminder kept on the phone, no login needed). The bar
holds only those two: an auth-gated Account tab (theme, notifications, email/password, profile,
logout, delete account) and an admins-only Admin tab of service status are hidden (`hidden: true`
in `TABS`), reachable only by a direct link, so the theme stays the saved mode (system by default). See the root
[CLAUDE.md](../CLAUDE.md) for architecture, [.claude/agents/frontend.md](../.claude/agents/frontend.md)
for the conventions to follow when changing anything here.

```bash
npm install
cp .env.example .env    # EXPO_PUBLIC_GATEWAY_ORIGIN — optional, only the dormant login/account screens use it
npx expo start          # for the dev build — see docs/frontend/environment.md
npm test                # Jest: the *.spec.{ts,js} under src/ (jest-expo, React Native Testing Library)
```

`maestro/` holds the phone smoke-test flows (Maestro YAML), run against the installed APK by
`node devops/maestro/smoke.js` from the repo root — an opt-in release check, never part of
`npm test`; see `.claude/agents/testing.md`'s "On the phone". They find elements by text and
accessibility label, so renaming "Add reminder", "Candle lighting", a stepper's "More min" or the
reminder form's summary line means updating them.

On your phone over Tailscale: the dev build ("Personal Copilot Dev", `apk.js build --dev`) loads the
code from `npx expo start` on `:8082` — see `docs/frontend/environment.md`. Expo Go can't run this
app (it lacks `expo-notifications`). The release build is the APK (Android app, below).

Matches the sibling project it's modeled on (`ask-my-crawl`) for theme/component conventions — the
same theme pipeline (`themeSlice` → `useAppTheme()`; `AmbientBackground` cross-fades its two
backdrops in 600ms on a switch), minus the Gluestack layer underneath `ask-my-crawl`'s own pipeline — nothing here
renders an actual Gluestack component, so it isn't here. `src/shared/theme/colors.js` holds the two
static palettes (dark: indigo/violet space theme; light: indigo/teal). The current look (space/glow/
gradient) is a known stepping-stone, expected to be replaced by a different, more animated style
later — keep it internally consistent until then rather than treating it as a fixed brand.

## Feature folders

```
app/                      routes only: each renders a feature's screen (+ the layouts, TABS)
src/features/<name>/      components/ screens/ store/ services/ utils/ hooks/ + index.js (public API)
  shabbat/                Home: clock, dates, Shabbat times, the candle-lighting reminder
  calendar/               the Calendar tab: month grid, day card
  reminders/              the user's own reminders
  app-update/             the APK's update sheet and chip
  account/                auth, profile, admin — dormant
src/lib/jewish-calendar/  the calendar maths — pure, no React
src/shared/               components/ (base/, composite/), theme/, config/, http/, utils/,
                          device/ (location, notifications, background tasks)
src/store/index.js        the root store: each feature's reducer (from its index.js) + persistence
src/store/backgroundTasks.js  background tasks, defined with the rehydrated store (loaded by index.js)
```

A feature imports from `shared/` and `lib/`, and another feature only through its `index.js`;
`shared/` and `lib/` never import a feature (so the root store isn't in `shared/`). A new feature =
a folder, a route, a `TABS` entry, its reducer in `src/store/index.js`.

`src/shared/components/` splits into `base/` (building blocks that use no other component —
grouped into subfolders by purpose:
`background/` — `Meteors`, `Stars`; `buttons/` — `FloatingButton`, `GradientButton`, `PillButton`; `feedback/` —
`Alert`, `VersionInfo`; `form/` — `InputField`, `SelectField`, `Stepper`, `Switch`; `layout/` —
`BottomSheet`, `CustomTabBar`, `GlowCard`, `Row`, `SwipePager`, `TabPager`) and `composite/` (built from one or more
base/composite components — `AmbientBackground`, `ConfirmModal`, `FormActions`, `SwipeTabs`, `ThemeCard`).
A component only one feature uses sits in that feature's `components/` (not UI-only, e.g.
account's `AuthLinks` navigates). See `.claude/agents/frontend.md` for the classification rule when
adding one.

Same Redux Toolkit + services-layer + Expo Router conventions otherwise: all I/O lives in a
feature's `services/` or `src/shared/` — `device/` (on-device I/O: `expo-location`, notifications),
`http/` (`httpClient`) — called only from thunks, never inline in a component. Shabbat times and
the Calendar tab's months need no network: calendar's `calendarService` computes them from
`src/lib/jewish-calendar/` (as JSON, times as ISO strings), so Home and the Calendar tab work
offline.

## Version

`src/shared/config/version.js` exposes the frontend's version and build time, which `apk.js build` reads from `version/versions.json` into `EXPO_PUBLIC_*` vars (so `expo start` shows
"dev"); the (hidden) Account tab's `VersionInfo` shows them. See `docs/specs/services.md#versions`.

## Android app

`node devops/android/apk.js build` builds the release APK in Docker (`expo prebuild --platform
android`, then Gradle) — see the root README. `app.json` holds the Android identity
(`com.lidor.personalcopilot`, which must never change, plus the permissions —
`REQUEST_INSTALL_PACKAGES` is for the in-app update); `app.config.js` adds the version and
Android's `versionCode`, both from `FRONTEND_VERSION`, which the build script sets (unset for `expo start`). `src/shared/utils/versionCode.js` is the one `versionCode()` — CommonJS,
since `app.config.js` and `devops/android/apk.js` load it in plain Node; the app uses it too, on
the baked `EXPO_PUBLIC_FRONTEND_VERSION`, to compare itself with the registry's `latest.json`.
The build also bakes `EXPO_PUBLIC_APK_REGISTRY_URL` (`URLS.apkRegistry`), where that check looks
(on start and back in the foreground); a dev server has none and never checks. Update APKs download to the app's cache (`updates/<versionCode>.apk`,
via a `.part` file) and are deleted once installed — see `docs/specs/services.md#frontend`. `plugins/withReleaseSigning.js` switches
the generated `android/app/build.gradle` from debug to release signing, with the key taken from env
vars only the build sets. `react-native-worklets` is a direct dependency so Reanimated 4's native
part links. `android/` is generated and git-ignored.

## App icon

One source, `assets/icon/icon.svg`, on Android's 108×108 adaptive-icon canvas with two layers
(`#background`, `#foreground`). `node devops/icons/render.js` renders every PNG from it in the
pinned Playwright image: the Android adaptive layers, `icon.png` and the splash image
(`expo-splash-screen` plugin in `app.json`). Edit the SVG, re-run the script, rebuild. Keep anything that matters inside the
66px safe circle: launchers show only the middle 72px, masked.

## Location (`expo-location`)

`app.json` registers the `expo-location` config plugin and the `ACCESS_COARSE_LOCATION`/
`ACCESS_FINE_LOCATION` permissions; only foreground location is used.

## Notifications (Android)

The phone's own reminders are exact local alarms
(`localNotificationsService.android.js`, which also owns the "Reminders" channel; expo-notifications
re-arms them after a reboot or an update, and `app.json`'s `USE_EXACT_ALARM` keeps them exact).
Showing them needs only Android's notification permission, no login: `notificationsSlice` reads it
(through the same service), and the Account card and a one-time prompt (`NotificationsPrompt`,
over any tab once a reminder exists) ask for it. A daily
background task (`backgroundTaskService.android.js`, expo-background-task / WorkManager)
re-runs their scheduling with the app closed. `index.js` loads, before the app (Android can start
the JS headless, for a task or with the app swiped away), `src/shared/device/notificationDisplay.js`
— the handler that shows a reminder due with the app open as a banner too — and
`src/store/backgroundTasks.js`, where background tasks are defined. Metro picks the files ending in
.android.js on Android; the plain `.js` ones do nothing and are what Jest's default platform
resolves. Flow and state rules: `docs/specs/services.md#frontend`.

## Phone numbers (`libphonenumber-js`)

The optional phone field (register, Account → Profile) is a country dropdown plus local digits;
`src/features/account/utils/phone.js` validates them with `libphonenumber-js` and converts to/from the E.164 form
the Users Service stores. Supported countries are `PHONE_COUNTRIES` — adding one is just a new
entry, the library already knows every numbering plan.

## Hebrew date (`@hebcal/hdate`)

The Home tab's Hebrew/Jewish date uses `@hebcal/hdate` rather than `Intl`'s `'he-u-ca-hebrew'`
calendar extension. Hermes (React Native's JS
engine) isn't guaranteed to ship non-Gregorian calendar tables in its bundled ICU data — the same
code can silently fall back to the Gregorian calendar on-device with no error. `@hebcal/hdate` is
pure JS with no ICU dependency, so it renders the same regardless of platform. Don't swap this
to `Intl` to drop the dependency without re-verifying on a phone first.

## APK registry (`devops/apk/`)

The `apk` container (`devops/apk/docker-compose.yml`, `caddy:2-alpine`) mounts `devops/data/apk`
read-only and serves it at `/apk/` (page and `latest.json` never cached, `.apk` with Android's
installer content type; `/` and `/apk` redirect there) — see `docs/specs/services.md#apk`.
`node devops/android/apk.js publish` writes it (directly, or via a Node container when `devops/data/apk` is root-owned):
every published APK, `releases.json` (each version's `version`, `versionCode`, `file`, `sha256`,
`size`, `publishedAt`, `notes`), `latest.json` (`{version, versionCode, url: "/apk/<file>", sha256,
notes, publishedAt}` for the newest release — never a `-test.N` build; absent until there is one;
the installed app's update check reads it)
and `index.html`, a static download page: every version newest first, light/dark via
`prefers-color-scheme`, the icon inlined from `assets/icon/icon.svg`, times in the phone's local
time. Versions sort by `src/shared/utils/versionCode.js`'s `versionCode()`. A published version's file
never changes — publishing a different one under it fails.
