# personal-copilot

A personal NestJS + Expo app, self-hosted on a home PC and used from a phone over Tailscale.
Today it shows Shabbat times (candle lighting, Havdalah, countdown) for the phone's location on the
Home screen, with optional login; signed in, you can set a weekly candle-lighting reminder,
delivered as a Web Push notification. A Jewish-calendar tab is next — see
[the plan](docs/plans/shabbat-reminders-calendar/plan.md).

See [CLAUDE.md](CLAUDE.md) for architecture, setup, and how this repo is organized —
[docs/specs/](docs/specs/) for the service/event contracts. To start the stack, follow CLAUDE.md's
"First run": it needs both `devops/.env` and `backend/.env`, including `VAPID_*` keys (the stack
won't boot without them).

## Phone access (Tailscale HTTPS)

The app reaches your phone over [Tailscale](https://tailscale.com). It must be served over HTTPS,
because phone browsers only allow location (GPS) on HTTPS pages — the Shabbat times need it.

One-time setup on this PC:

```bash
curl -fsSL https://tailscale.com/install.sh | sh     # install
sudo tailscale up                                      # log in (opens a browser link)
sudo tailscale set --operator=$USER                    # lets serve.js run without sudo
```

In the Tailscale admin console (DNS page), turn on **MagicDNS** and **HTTPS Certificates**. Install
Tailscale on your phone and log in with the same account.

Then, with the stack running:

```bash
node devops/tailscale/serve.js     # prints your https://<pc>.ts.net URLs
```

Set the printed Gateway URL as `GATEWAY_PUBLIC_URL` in `devops/.env`, rebuild the frontend
(`cd devops && docker compose up -d --build frontend`), and open `https://<pc>.ts.net` on your
phone. `tailscale serve` settings survive reboots; `tailscale serve reset` removes them.

**Reminders on the phone** arrive as Web Push notifications, even with the screen locked and the
browser in the background: sign in, then tap "Turn on" (or the Account tab's Notifications switch)
and allow. If nothing arrives on the phone while the PC gets it, the message reached Google's push
service and the phone held it back. In Android's settings, allow the browser's notifications and
set its battery use to Unrestricted. Swiping the browser out of recent apps can force-stop it on
some phones, and a stopped app gets nothing until it's opened again. Chrome is the most reliable
browser for this; Brave works once those settings allow it.

## Android app (APK)

The same app as a real Android app. One Node script, same on Linux and Windows; the build runs in
Docker (nothing else to install):

```bash
node devops/android/apk.js build     # → devops/data/android/apk/personal-copilot-<version>.apk
node devops/android/apk.js publish "Release note" "Another note"   # → https://<pc>.ts.net/apk/
node --test devops/android/apk.test.js          # the publisher's tests, on the host
```

It talks to `GATEWAY_PUBLIC_URL` from `devops/.env`, which must be the HTTPS tailnet URL (see
above), so the phone needs Tailscale on. The first build downloads the Android SDK and Gradle into
Docker volumes and takes a while; later ones are faster. `ANDROID_ABIS=arm64-v8a,x86_64` builds
`personal-copilot-<version>-emulator.apk` for an x86_64 emulator instead.

The first run also creates the release signing key in `devops/data/android/` (git-ignored).
**Back up `release.keystore` and `keystore.properties` from there.** Every later APK must be signed
with the same key to update the installed app; with a new key you'd have to uninstall it (and sign
in again) first. The APK doesn't receive notifications yet; reminders reach your browsers
only.

`publish` puts the built APK (the `frontend` version, or `--version X`) on the download
page at `https://<pc>.ts.net/apk/`, each argument one bullet of its release notes. Every published
version stays downloadable; the newest release is highlighted, and `-test.N` builds are listed as
test builds. Publishing the same version and file again replaces its notes (no notes: just
regenerates the page, and puts back a published APK that went missing); a different file under a
published version is refused — bump the version. On the phone, the first install asks to allow
installs from Chrome, and Google Play Protect may block the app as from an unknown developer:
More details → Install anyway (the page says so too). `publish` writes `devops/data/apk/` directly, or through a `node:22-alpine`
container when that folder isn't writable (root-owned on Linux, since Docker created it).

**Updates.** Once installed, the app checks the registry's `latest.json` at start, whenever it
comes back to the foreground, and right after a publish while it's open (`apk.js publish`
announces the release on Kafka, and Gateway tells every open app over its WebSocket). When a newer version is published, a
sheet with its release notes opens by itself (once per version; after Later, an "↑ <version>" chip on Home reopens it). Update
downloads the APK inside the app and opens Android's installer — the first time, Android asks to
allow installs from Personal Copilot. Only releases count: `-test.N` builds never reach
`latest.json`. The registry address is baked in at build time: `APK_REGISTRY_URL` (env or
`devops/.env`), else `https://<GATEWAY_PUBLIC_URL's host>/apk/` — the frontend's HTTPS address as
`devops/tailscale/serve.js` publishes it.

## Versions

Every component's version is in `version/versions.json`; `node scripts/version.js` shows and bumps them
(rules in CLAUDE.md's "Versions"). The Account tab shows the frontend's version; backend services
report theirs on their internal `/health`, and the Admin tab (admins only) lists them all.

## Docs drift check

`node scripts/docs-check.js` checks the docs against the code (paths they name, env vars, Kafka
topics, queues, Caddy's Gateway routes, services, version components, no plan references) and exits
1 on drift; `--changed` first lists the docs your uncommitted changes should update.

## Git rule for Claude and every agent

**Never stage or commit anything unless the user explicitly says so** ("stage this", "commit
this"). Finishing a task, ticking a plan box, or being told "ok, go ahead" is *not* permission.
Leave all changes unstaged in the working tree so the user can review the diff first.
