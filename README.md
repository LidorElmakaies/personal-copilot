# personal-copilot

A personal NestJS + Expo app, self-hosted on a home PC and used from a phone over Tailscale.
Today it shows Shabbat times (candle lighting, Havdalah, countdown) for the phone's location on the
Home screen and a Jewish-calendar month (both dates, holidays and fasts) on the Calendar tab, with
optional login. With no login needed, you can set a weekly candle-lighting reminder and add your own
reminders on the calendar (once, daily, monthly or yearly, by the Gregorian or Hebrew date), both
kept on the phone and fired by the Android app as local notifications (exact alarms, no server).
Reminders saved on the server still arrive as push notifications (FCM) on an Android phone
registered with it until they're removed — so one set in both places arrives twice.

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

**Reminders** are notifications from the Android app (below), which schedules them itself; the
web app shows none (it has no service worker and subscribes to no push).

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
in again) first. The APK shows its reminders once Android's notification permission is allowed (it
asks once, on Home). For server push (FCM) to a phone registered with it, put Firebase's `google-services.json` (Firebase → your Android app
`com.lidor.personalcopilot`) in `devops/data/android/` too — the build uses it when it's there.

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

## Secrets between PCs

The secrets — `backend/.env`, `devops/.env`, and in `devops/data/android/` the signing key
(`release.keystore`), its passwords (`keystore.properties`) and Firebase's `google-services.json` —
never go in git. `scripts/secrets.js` packs them into one encrypted file. It works with two files,
both in the repo's `secrets/` folder (gitignored, so they never reach git either):

| File | What it is |
| --- | --- |
| `secrets/secrets.enc` | every secret above, encrypted (AES-256-GCM) |
| `secrets/secrets-key.json` | the key that opens it — without it secrets.enc can't be read |

**Where they're kept:** both in your Google Drive, uploaded and downloaded by hand. Drive is the
only copy off the PCs, so don't lose access to it. Anyone who gets both files can read every
secret; keeping secrets-key.json in a password manager instead of next to secrets.enc is safer.

**Decrypt on a PC** (a new one, or after another PC changed a secret):

1. Download `secrets.enc` and `secrets-key.json` from Google Drive into the repo's `secrets/` folder
   (create it if it's missing).
2. `node scripts/secrets.js pull` — writes each secret into place; any file it replaces is kept as
   `<file>.bak` (gitignored).

**Change a secret:** edit it on this PC, `node scripts/secrets.js push` (rewrites
`secrets/secrets.enc`), then upload it to Google Drive over the old one — Drive keeps the earlier
versions. `node scripts/secrets.js status` shows what differs between secrets.enc and this PC.

Each PC keeps its own `GATEWAY_PUBLIC_URL`/`APK_REGISTRY_URL` (stored blank, filled from the PC's
own `devops/.env`). `pull` refuses, unless you add `--force`, to replace this PC's signing key or to
change `PASSWORD_PEPPER` (that breaks every password stored on this PC). A damaged secrets.enc, or
the wrong key, is refused instead of written out. `node scripts/secrets.js init` made the key once;
run it again only to start over with a new key (then push and upload both files).

## Versions

Every component's version is in `version/versions.json`; `node scripts/version.js` shows and bumps them
(rules in CLAUDE.md's "Versions"). The Account tab shows the frontend's version; backend services
report theirs on their internal `/health`, and the Admin tab (admins only) lists them all.

## Docs drift check

`node scripts/docs-check.js` checks the docs against the code (paths they name, env vars incl. `devops/.env`, Kafka
topics, queues, Caddy's Gateway routes, services, version components, no plan references) and exits
1 on drift; `--changed` first lists the docs your uncommitted changes should update.

## Git rule for Claude and every agent

**Never stage or commit anything unless the user explicitly says so** ("stage this", "commit
this"). Finishing a task, ticking a plan box, or being told "ok, go ahead" is *not* permission.
Leave all changes unstaged in the working tree so the user can review the diff first.
