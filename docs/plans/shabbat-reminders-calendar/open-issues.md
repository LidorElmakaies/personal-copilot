# Open issues and small decisions

Things found while building stage 2 (mostly by the `testing`, `docs` and `devops` agents) that were
deliberately left for later. Each one says what's wrong, why it matters, and the suggested fix.
The plan's own open questions (holiday eves, location denied) stay in [`plan.md`](plan.md).

## Bugs

- [x] **Seeded admin can't use the app.** *Fixed by plan task 2.17.* Auth issues the admin a token with `role: 'admin'`, but
  `JsonWebTokenService.verify` (`libs/auth-kernel/src/jsonwebtoken.service.ts`) accepts only
  `'user'`, so every `JwtAuthGuard` route and the WebSocket reject it. The comment in
  `jwt-service.interface.ts` ("extend this union to add a role, no schema change needed") is
  misleading for the same reason.
  *Fix:* let `verify` accept every `UserRole`, or drop the admin seed.

## Security / config

- [ ] **Postgres receives the backend secrets.** It inherits `backend/.env` (JWT secret, pepper,
  VAPID private key) through `common.yml`'s `env_file`. Redis already has the fix.
  *Fix:* `env_file: !reset []` in `devops/postgres/docker-compose.yml`.
- [ ] **Redis overcommit warning** (needs sudo, optional):
  `echo 'vm.overcommit_memory = 1' | sudo tee /etc/sysctl.d/99-redis.conf && sudo sysctl --system`,
  then `docker compose restart redis` from `devops/`.

## Notifications: contract and validation

- [ ] **Timestamps without a time zone are accepted.** `expiresAt`/`requestedAt` are checked with
  `Date.parse`, so `2026-10-02T18:04:00` (no `Z`/offset) is read in the server's time zone.
  *Fix:* require `Z` or an offset in the guard.
- [ ] **`channels: []` passes the guard** and delivers nothing. *Fix:* reject an empty list.
- [ ] **Invalid `expiresAt` in `notificationRequestedPublishOptions`** gives `dedupeTtlMs: NaN`
  (BullMQ then dedupes only until the job finishes). The consumer rejects such a message anyway.
  *Fix:* publishers validate with the guard before publishing, or the helper throws.
- [ ] **No cap on the push TTL.** A far-future `expiresAt` sends a huge TTL; push services cap
  around 4 weeks. *Fix:* cap at 2 419 200 s.
- [ ] **`p256dh` is only length-checked**, not that it's a real P-256 point. A bad key is logged
  as a failure on every push and its row is never removed. *Fix:* validate the point at subscribe
  time, or delete the row on that crypto error.

## Notifications: rare delivery cases (accepted duplicates, noted for completeness)

- **Two runs of the same job at once** (BullMQ lock lapses mid-run) can overwrite each other's
  saved "device done" marks, so a retry may re-send to more than one device.
- **A job that stalls twice fails immediately** (BullMQ's default `maxStalledCount` is 1).
- **A crash after a push was accepted but before "done" was saved** re-sends to that one device.

## Tests and tooling

- [ ] **No Postgres integration tests for the repositories.** Notably untested: that
  `upsert(['endpoint'])` keeps the row `id` when a browser re-subscribes (that id is the job
  progress key). Needs testcontainers or a throwaway Postgres.
- [ ] **`.claude/agents/testing.md` claims** Auth's repositories are tested with
  `@testcontainers/postgresql` — that package isn't installed and no such tests exist.
- [ ] **Pre-existing type error:** `tsc` reports two errors in
  `libs/jewish-calendar/src/shabbat-calendar.spec.ts` (lines ~108, 112); Jest still passes.

## Docs

- [x] **`CLAUDE.md`'s "First run" never mentions the `VAPID_*` keys** in `backend/.env`; the
  Notification Service refuses to start without them.

## Product ideas / small decisions

- [ ] **Device list on the Account tab** ("Pixel · Chrome", "Laptop · Brave", each with Remove).
  The backend can already remove one; it needs a list endpoint and a small screen. After 2.7.
- [ ] **Refresh location / Shabbat times when the app returns to the foreground** (today: only
  at app start).
- [ ] **The red "Disconnected" chip while signed out:** hide it, or show "Signed out"?

## Harmless leftovers

- `devops/data/redis/dump.rdb` (89 bytes) from before snapshots were turned off; Redis loads from
  the AOF, so it can be deleted any time.
