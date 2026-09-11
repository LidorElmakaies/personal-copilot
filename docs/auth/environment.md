# Auth Service environment

Read from `backend/.env` locally (`npx nest start auth`), or from `devops/docker.env` +
`devops/auth/docker-compose.yml` in Docker. See `backend/.env.example` for the full variable list
with defaults.

- **`PORT`** — deliberately not set in the shared `backend/.env`. Auth defaults to `8001` in its
  own `main.ts` when unset — see [docs/gateway/environment.md](../gateway/environment.md) for why
  this file never sets `PORT` directly.
- **`JWT_SECRET`** — must match Gateway's copy exactly (Auth signs, Gateway verifies).
- **`PASSWORD_PEPPER`** — mixed into every password hash (`infrastructure/hashing/salt-pepper-
  sha256.hasher.ts`: `sha256(pepper + salt + plaintext)`). Must stay identical across restarts, or
  every existing password hash stops verifying.
- **`DATABASE_URL`** — Postgres connection string.

## Admin seed (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)

`AdminSeedService` (`application/admin-seed.service.ts`) creates one admin account **once**, on
whichever boot first finds no user with that email. It hashes `ADMIN_PASSWORD` through the same
`IPasswordHasher` (fresh random salt + `PASSWORD_PEPPER` + SHA-256) as `register()` uses for every
other user — the plaintext env value is never itself written to the database.

This is intentionally a one-time seed, not a sync:
- Leave `ADMIN_EMAIL`/`ADMIN_PASSWORD` unset to skip seeding entirely.
- Once the account exists, changing these vars and restarting does **nothing** — the service only
  ever calls `create()`, never touches an existing row. This is deliberate: a password changed by
  hand (or by a future "edit user" admin feature, whenever one gets built) must survive a restart
  instead of reverting to whatever's still in `.env`.
- To change the seed password *before* the account exists, edit `.env` and restart. To change it
  *after*, use a direct DB update for now — not `.env`.
