---
name: feedback_gateway_only_service_access
description: "Hard rule for personal-copilot, carried over from askmycrawl: nothing external ever reaches users (or any other internal service) directly — only Gateway (the apk registry excepted, it serves static files, not a backend service). Internal service-to-service calls (Gateway->service HTTP) are unaffected."
metadata:
  node_type: memory
  type: feedback
  modified: 2026-09-06
---

**Carried over from [[askmycrawl-project]]'s equivalent rule.** "External" means anything outside
the Docker network: your phone (over Tailscale), a browser, curl, etc. `gateway` is the only
*backend* service with a published port; `users` and any future internal service are internal-only
and must stay that way. If a design under consideration would add a published port to any of them,
stop and ask first.

**`apk` is the one intentional exception** — it publishes `127.0.0.1:8081` (`devops/apk/`, a Caddy
serving the APK registry's static files). It's not a backend service and this rule doesn't restrict
it. The rule's mirror image on the app's *code*: the app only ever calls `gateway`, never `users`
(or any future backend service) directly. The one exception is read-only static files: the update
check fetches `latest.json` and the APK from `apk` (`/apk/`) — no API call ever bypasses Gateway.
(The app currently calls no backend at all; this applies when the dormant login comes back.)

**Does not restrict internal service-to-service calls** — Gateway's plain-HTTP call to `users` is
the normal, already-resolved architecture (see `docs/specs/services.md`), not something this rule
touches.

**Why:** same reasoning as [[askmycrawl-project]]'s original — the user wants a single, deliberate
boundary between "reachable from outside" and "internal", enforced structurally (only one backend
service exposed) rather than left to convention. This project goes one step further than
askmycrawl's own precedent: `users`' port is never published at all, not even as documented debt —
askmycrawl's Auth Service still exposes `8001:8001` as a known-but-unfixed exception; this project
started without that exception since there's no legacy reason to carry it.

**How to apply:** when adding anything to `devops/<service>/docker-compose.yml`, don't add a
`ports:` entry to `users` or any future internal service without asking first. `apk`/`gateway`
already have theirs. When adding a frontend feature, check whether it would call a backend service
other than Gateway directly — surface it and ask before implementing.
