# Users Service — implementation notes

The contract (endpoints, token shapes, hashing) lives in
[`docs/specs/services.md`](../../../docs/specs/services.md#users). This file is the "why" behind
decisions here that aren't obvious from the code or from that doc alone.

## Admin seed (`admin-seed.service.ts`)

`ADMIN_EMAIL`/`ADMIN_PASSWORD` (`.env.example`) seed a `role: 'admin'` user on boot, once, if no
user with that email already exists. It never touches an existing row — a restart must not revert
a password that's since been changed by hand (or by a future "edit user" admin feature) back to
whatever's still sitting in `.env`. To rotate the seed password itself, change `ADMIN_PASSWORD`
before the very first boot, or update the row directly, rather than restarting the service.
Hashed the same way as any other user (random salt + `PASSWORD_PEPPER` + SHA-256, see
`SaltPepperSha256Hasher`) — `ADMIN_PASSWORD` only ever lives in `.env` as plaintext, same as any
other secret in that file, and is never itself written to the database.

## `synchronize: true` below production (`users.module.ts`)

TypeORM's `synchronize` (auto-migrates entities to match the schema on boot) is on for every
`NODE_ENV` except `production`. Simplest thing that works for a single-user personal project — no
migration framework exists yet. Revisit before this service ever holds data that matters to lose.
