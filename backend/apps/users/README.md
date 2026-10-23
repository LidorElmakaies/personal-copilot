# Users Service — implementation notes

The contract (endpoints, token shapes, hashing) lives in
[`docs/specs/services.md`](../../../docs/specs/services.md#users). This file is the "why" behind
decisions here that aren't obvious from the code or from that doc alone.

## Admin seed (`admin-seed.service.ts`)

A one-time seed, never a sync — see [`docs/users/environment.md`](../../../docs/users/environment.md#admin-seed-admin_email--admin_password).

## `synchronize: true` below production (`users.module.ts`)

TypeORM's `synchronize` (auto-migrates entities to match the schema on boot) is on for every
`NODE_ENV` except `production`. Simplest thing that works for a single-user personal project.
Revisit before this service ever holds data that matters to lose.

`synchronize` only alters tables that have an entity, and production doesn't run it, so a change
an existing database must get (a dropped table or column) is a migration in
`infrastructure/postgres/migrations/`, listed in `users.module.ts`'s `migrations` and applied on
boot (`migrationsRun`, recorded in `users.migrations`). TypeORM runs migrations before
`synchronize`, so each one must also work on a new database (`IF EXISTS`).
