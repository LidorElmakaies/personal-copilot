---
name: feedback_gateway_only_service_access
description: "Hard rule for shabbat-notifier, carried over from askmycrawl: nothing external ever reaches auth (or any future internal service) directly — only Gateway (frontend excepted, it's a static web export, not a backend service). Internal service-to-service calls (Kafka, and Gateway->Auth HTTP) are unaffected."
metadata:
  node_type: memory
  type: feedback
  modified: 2026-09-06
---

**Carried over from [[askmycrawl-project]]'s equivalent rule.** "External" means anything outside
the Docker network: your phone (over Tailscale), a browser, curl, etc. `gateway` is the only
*backend* service with a published port; `auth` and any future internal service are internal-only
and must stay that way. If a design under consideration would add a published port to any of them,
stop and ask first.

**`frontend` is the one intentional exception** — it publishes port 8081 (a static Expo web
export, served by Caddy). It's not a backend service and this rule doesn't restrict it, but the
rule it enforces on the frontend's *code* is the mirror image: the frontend only ever calls
`gateway`, never `auth` (or any future backend service) directly, even though nothing stops it at
the network level the way an unpublished port does for a browser.

**Does not restrict internal service-to-service calls** — Gateway's plain-HTTP call to `auth`, and
whatever Kafka producer/consumer wiring a future feature adds between internal services, is the
normal, already-resolved architecture (see `docs/specs/services.md`), not something this rule
touches.

**Why:** same reasoning as [[askmycrawl-project]]'s original — the user wants a single, deliberate
boundary between "reachable from outside" and "internal", enforced structurally (only one backend
service exposed) rather than left to convention. This project goes one step further than
askmycrawl's own precedent: `auth`'s port is never published at all, not even as documented debt —
askmycrawl's Auth Service still exposes `8001:8001` as a known-but-unfixed exception; this project
started without that exception since there's no legacy reason to carry it.

**How to apply:** when adding anything to `devops/<service>/docker-compose.yml`, don't add a
`ports:` entry to `auth` or any future internal service without asking first. `frontend`/`gateway`
already have theirs. When adding a frontend feature, check whether it would call a backend service
other than Gateway directly — surface it and ask before implementing.
