# Frontend environment

Every `EXPO_PUBLIC_*` value is inlined into the bundle at build time — there's no runtime
environment to read later. `node devops/android/apk.js build` sets them for the APK (see
`docs/specs/architecture.md#compose--build-layout`); `npx expo start` reads `frontend/.env`.

- **`EXPO_PUBLIC_GATEWAY_ORIGIN`** (`frontend/.env.example` → `frontend/.env`) — optional: only
  the dormant login/account screens call Gateway (`URLS.gateway` is `null` without it, and their
  calls fail); Home, Calendar, reminders and updates don't need it. A shell env var overrides the
  file, which is how Expo Go on the phone reaches Gateway over Tailscale without editing it:
  `EXPO_PUBLIC_GATEWAY_ORIGIN=http://<pc-tailnet-ip>:8000 REACT_NATIVE_PACKAGER_HOSTNAME=<pc-tailnet-ip> npx expo start --port 8082`
  (`8081` is taken by `apk`), then open `exp://<pc-tailnet-ip>:8082` in Expo Go. Plain HTTP is
  fine for a dev server. The APK gets it from `devops/.env`'s `GATEWAY_PUBLIC_URL` (HTTPS when
  set — `docs/devops/environment.md`).
- **`EXPO_PUBLIC_APK_REGISTRY_URL`** — where the update check looks (`URLS.apkRegistry`), from
  `APK_REGISTRY_URL` or `GATEWAY_PUBLIC_URL`'s host (`docs/devops/environment.md`). Unset in a dev
  server, which then never checks.
- **`EXPO_PUBLIC_FRONTEND_VERSION`** / **`EXPO_PUBLIC_BUILT_AT`** — the `frontend` version from
  `version/versions.json` and the build time, shown by `VersionInfo` and compared with the
  registry's `latest.json`. Unset in a dev server ("dev").
