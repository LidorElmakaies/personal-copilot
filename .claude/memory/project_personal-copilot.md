---
name: personal-copilot-project
description: "personal-copilot (renamed from shabbat-notifier) — what it is, where it's hosted, how it relates to ask-my-crawl, and design preferences the user has shown along the way. CLAUDE.md has the current architecture."
metadata:
  node_type: memory
  type: project
---

**personal-copilot** — renamed from **shabbat-notifier** on 2026-09-07; GitHub:
https://github.com/LidorElmakaies/personal-copilot. A NestJS + Expo app: Gateway, Users, Reminders
and Notifications services, OTel observability, and an Expo frontend (web + an Android APK) with
optional login. The first feature (Shabbat times, candle-lighting reminders, a Jewish calendar) is
built in stages from `docs/plans/shabbat-reminders-calendar/plan.md`. **The root `CLAUDE.md` is the
source of truth for what exists** — this file only holds context that isn't in the code.

**Hosting**: the user's personal PC, reached from their phone over Tailscale (`tailscale serve`
puts frontend and Gateway behind HTTPS on the PC's `*.ts.net` name — phone browsers need HTTPS for
GPS). Gateway is published on `127.0.0.1` only.

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
- When stripping a feature back, keep reusable plumbing its first consumer happened to need (Kafka,
  the `/ws` realtime layer) and remove only what implements the feature itself.
- The space/glow/gradient look is a stepping stone toward a more animated design, not a settled
  brand — expect a full restyle, and keep components easy to swap.
- Prefers fixing root causes over patches, one clean mechanism over several, and less code over
  more (e.g. one route table instead of a module per proxied service).

See [[feedback_commits_need_explicit_approval]] and [[feedback_docs_current_state_only]].
