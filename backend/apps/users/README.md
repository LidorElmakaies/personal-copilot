# Users Service — implementation notes

The contract (endpoints, token shapes, hashing) lives in
[`docs/specs/services.md`](../../../docs/specs/services.md#users). This file is the "why" behind
decisions here that aren't obvious from the code or from that doc alone.

## Admin seed (`admin-seed.service.ts`)

A one-time seed, never a sync — see [`docs/users/environment.md`](../../../docs/users/environment.md#admin-seed-admin_email--admin_password).

## `synchronize: true` below production (`users.module.ts`)

TypeORM's `synchronize` (auto-migrates entities to match the schema on boot) is on for every
`NODE_ENV` except `production`. Simplest thing that works for a single-user personal project — no
migration framework exists yet. Revisit before this service ever holds data that matters to lose.
