---
name: personal-copilot-project
description: "personal-copilot (renamed from shabbat-notifier) — what it is, where it's hosted, how it relates to ask-my-crawl, and design preferences the user has shown along the way. CLAUDE.md has the current architecture."
metadata:
  node_type: memory
  type: project
---

**personal-copilot** — renamed from **shabbat-notifier** on 2026-09-07; GitHub:
https://github.com/LidorElmakaies/personal-copilot. Since 2026-10-23 an **Android-only Expo app**:
Shabbat times, the Jewish calendar and every reminder are computed and stored on the phone and fired
as local notifications, no login needed (the Android-only refactor; its plan and the earlier
Shabbat & calendar plan were deleted 2026-10-27). Next feature: Finance, `docs/plans/finance/`. The NestJS Gateway + Users Service (login,
profiles) stay in the repo **dormant**, behind `docker compose --profile backend`; the Reminders and
Notification services, Kafka, Redis and the web app were deleted. **The root `CLAUDE.md` is the
source of truth for what exists** — this file only holds context that isn't in the code.

**Hosting**: the user's personal PC, reached from their phone over Tailscale. What runs by default
is only `devops/apk/` — a Caddy serving the APK registry at `https://<pc>.ts.net/apk/` (through
`tailscale serve`), where installed apps check for updates; that address must never change or every
installed phone loses its updates. Gateway (dormant) is published on `127.0.0.1` only.

**Bootstrapped from [[askmycrawl-project]]'s conventions** (a sibling repo, not on this machine):
the Nest-CLI monorepo shape, hexagonal API/Application/Infrastructure layering with Symbol DI
tokens, the Gateway + auth-service split with a shared `libs/auth-kernel`, per-service
`devops/<service>/docker-compose.yml` via `include:`, the Expo Router + Redux Toolkit +
services-layer frontend, and `.claude/agents` + `.claude/memory`. Deliberately different: no
Gluestack layer on the frontend (nothing rendered a Gluestack component), internal services never
publish a port (see [[feedback_gateway_only_service_access]]), Grafana published directly
(Tailscale is the boundary).

**How this user thinks about design** (learned from earlier corrections):
- Derive client-visible data from something already held rather than add a round trip or a second
  source of truth — e.g. the access token carries `{ sub, role, email }`, so there's no `GET /me`
  and the frontend decodes the token.
- When stripping a feature back, remove only what implements the feature itself — but once
  plumbing has no consumer left (Kafka, Redis, the `/ws` layer, services, libraries, scripts,
  leftover data), the user wants it gone in a full sweep across backend, devops, scripts and
  frontend, not kept "in case". Dormant code is kept only when explicitly decided (the auth work).
- The space/glow/gradient look is a stepping stone toward a more animated design, not a settled
  brand — expect a full restyle, and keep components easy to swap.
- Prefers fixing root causes over patches, one clean mechanism over several, and less code over
  more (e.g. one route table instead of a module per proxied service).

See [[feedback_commits_need_explicit_approval]] and [[feedback_docs_current_state_only]].
