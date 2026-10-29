# Frontend environment

Every `EXPO_PUBLIC_*` value is inlined into the bundle at build time — there's no runtime
environment to read later. `node devops/android/apk.js build` sets them for the APK (see
`docs/specs/architecture.md#compose--build-layout`); `npx expo start` reads `frontend/.env`.

- **`EXPO_PUBLIC_GATEWAY_ORIGIN`** (`frontend/.env.example` → `frontend/.env`) — optional: only
  the dormant login/account screens call Gateway (`URLS.gateway` is `null` without it, and their
  calls fail); Home, Calendar, reminders and updates don't need it. A shell env var overrides the
  file (see the dev build below). The APK gets it from `devops/.env`'s `GATEWAY_PUBLIC_URL` (HTTPS when
  set — `docs/devops/environment.md`).
- **`EXPO_PUBLIC_APK_REGISTRY_URL`** — where the update check looks (`URLS.apkRegistry`), from
  `APK_REGISTRY_URL` or `GATEWAY_PUBLIC_URL`'s host (`docs/devops/environment.md`). Unset in a dev
  server, which then never checks.
- **`EXPO_PUBLIC_FRONTEND_VERSION`** / **`EXPO_PUBLIC_BUILT_AT`** — the `frontend` version from
  `version/versions.json` and the build time, shown by `VersionInfo` and compared with the
  registry's `latest.json`. Unset in a dev server ("dev").
- **`EXPO_PUBLIC_STORYBOOK`** — `true` only for a dev server started for Storybook (below): the
  dev build then shows Storybook instead of the app. Unset everywhere else, every APK included —
  `frontend/metro.config.js` then strips Storybook out of the bundle.

## The dev build

"Personal Copilot Dev" (`com.lidor.personalcopilot.dev`, built by `node devops/android/apk.js build
--dev`, installed once next to the real app) runs the app's code live from the PC. Expo Go can't —
it lacks `expo-notifications`. From `frontend/`:

`APP_VARIANT=dev EXPO_NO_TYPESCRIPT_SETUP=1 REACT_NATIVE_PACKAGER_HOSTNAME=<pc-tailnet-ip> npx expo start --dev-client --port 8082`

then open `http://<pc-tailnet-ip>:8082` in the dev build's launcher. `8081` is taken by `apk`.

- **`APP_VARIANT=dev`** — the dev build's app id, name and link scheme (`personalcopilotdev://`),
  from `frontend/app.config.js`.
- **`EXPO_NO_TYPESCRIPT_SETUP=1`** — skips `expo start`'s offer to install TypeScript (it sees
  `src/lib/jewish-calendar/`'s `.ts` files; Metro builds them without it).
- **`REACT_NATIVE_PACKAGER_HOSTNAME`** — the address the phone is told to load the code from.
- Add `EXPO_PUBLIC_GATEWAY_ORIGIN=http://<pc-tailnet-ip>:8000` for screens that call Gateway; plain
  HTTP is fine for a dev server.

## Storybook

Every component and screen can be looked at on its own, in each of its states, on the phone: its
stories sit next to it (`PillButton.stories.js`), one exported story per state — see
`.claude/agents/frontend.md`'s "Storybook". The same dev server as above, with Storybook on and a
cleared cache (an `EXPO_PUBLIC_*` value is baked into the cached bundle):

`EXPO_PUBLIC_STORYBOOK=true APP_VARIANT=dev EXPO_NO_TYPESCRIPT_SETUP=1 REACT_NATIVE_PACKAGER_HOSTNAME=<pc-tailnet-ip> npx expo start --dev-client --port 8082 --clear`

then open it in the dev build as above: the story list instead of the app, in the phone's own light or dark
(Storybook clears a theme the dev build saved). Back to the app: restart without `EXPO_PUBLIC_STORYBOOK`, again
with `--clear`. On Windows, set each variable first in PowerShell (`$env:EXPO_PUBLIC_STORYBOOK='true'`, …).
