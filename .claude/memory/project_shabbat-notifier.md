---
name: shabbat-notifier-project
description: "shabbat-notifier — a NestJS/Expo scaffold (Gateway, Postgres-backed Auth Service, OTel observability, a frontend with login) kept as the base for a not-yet-decided feature, after the original Shabbat/WhatsApp feature was deliberately stripped back out. Stack, architecture, where things live."
metadata:
  node_type: memory
  type: project
---

**shabbat-notifier** (this repo, folder name unchanged) is currently a clean-slate scaffold: NestJS
Gateway + Postgres-backed Auth Service + full OTel observability + an Expo frontend with working
login/register. No product feature is built on top of it right now — see **Third revision note**
below for why. Treat the sections below describing what actually exists as current; the original
Shabbat/WhatsApp feature they describe having *replaced* is gone from the code entirely.

**Revision note**: the original build (2026-09-06) served a token-linked, login-free HTML page
directly from Gateway and used Redis for short-lived token correlation. Replaced same day, at the
user's request, with a real Expo frontend + full login (Postgres-backed Auth Service, mirroring
[[askmycrawl-project]]'s Auth Service) + WebSocket push for the result — Redis and the token flow
were removed entirely once the JWT-carried user identity made them redundant.

**Second revision note, same day**: the user then questioned why a `GET /me` endpoint existed at
all, given the JWT already carries `sub`/`role` — pushed toward "the information the client needs
should live inside the token itself." Applied: added `email` to the JWT payload (`{ sub, role,
email }`), removed `GET /me` from both `apps/auth` and Gateway's auth-proxy entirely, and stopped
register/login/refresh from returning a `user` object at all (tokens only) — the frontend now
derives its `user` object by decoding the access token (`getUserFromToken` in
`frontend/src/utils/jwt.js`) rather than storing a separately-fetched/returned copy. General
pattern worth remembering about how this user thinks about API design: prefers deriving
client-visible data from something already held (a token, in this case) over adding a network
round trip or a second source of truth for the same fact, when the tradeoff (a token can go stale
until reissued) is genuinely a non-issue for the feature set at hand.

**Third revision note (2026-09-06)**: the user decided to strip the Shabbat/WhatsApp feature back
out entirely — "i want to start from a clean start" — keeping only `gateway`, `auth`, and the OTel
observability stack, explicitly naming those three as what to keep. Deleted: `apps/shabbat-
notifier`, `apps/whatsapp`, `libs/whatsapp-client`, Gateway's `shabbat-location/` module, all four
Kafka message shapes, the frontend's Shabbat tab/slice/WS layer, and every Baileys/Hebcal/tz-lookup
dependency. Kept, per the user's explicit choices when asked: the frontend's login/register + a
Settings tab (renamed from the old settings screen, now the app's only tab), and generic Kafka
plumbing (`libs/kafka-client`, the `kafka` broker) — `libs/kafka-contracts` is now an empty shell
with no topics. `docs/specs/*.md`, `CLAUDE.md`, and all four `.claude/agents/*.md` files were
rewritten in the same pass to describe only what remains.

**Fourth revision note, same day**: Gateway's `realtime/` (Socket.IO) module was deleted in that
pass too, on the reasoning that it only ever served the Shabbat feature — wrong distinction. The
user corrected it: "we still need a realtime connection for other stuff in the future," the same
"keep as generic plumbing" treatment Kafka got, which the removal pass should have applied to
`realtime/` on its own without being asked twice. Restored: the WS connection lifecycle
(`RealtimeGateway`, handshake auth, `InMemoryConnectionStore`) and `IRealtimeConnectionService
.pushToUser(userId, event, payload)` as the generic entry point — deliberately *not* restored: the
`shabbat-updates.controller.ts` Kafka consumer, since that piece really was Shabbat-specific (it
only existed to relay one particular topic). **General lesson**: when asked to strip a feature back
to bare infrastructure, distinguish "this code implements the feature" from "this code is reusable
plumbing the feature happened to be the first consumer of" — Kafka got this distinction correctly
the first time (kept because it's generic infra), the WS layer didn't (deleted despite being
equally generic infra) — apply the same test to every piece being removed, not just the one the
user happened to call out by name.

**Fifth revision note, same day**: the user pointed at `ask-my-crawl`'s frontend agent/rules and
asked for our login to match its style, explicitly framing it as transitional: "in the future we
will change our style fully from this style to a different more 3d version with transitions." So
the space/glow/gradient look (and the theme pipeline behind it) is a deliberate stepping stone, not
a settled brand decision — don't be surprised by, or resist, a full frontend redesign later; the
current components/palette are meant to be easy to swap out, not defended as final. Ported: the
three-layer theme pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`, 600ms
transitions), the dark indigo/violet + light indigo/teal palettes, and the shared components
(`GlowCard`, `GradientButton`, `InputField`, `SpaceBackground`, `ConnectionStatus`) — applied to
login/register and a rebuilt Settings screen (added a light/dark toggle, since `themeSlice.mode`
needs a UI control to be reachable at all). Deliberately **not** ported: `ask-my-crawl`'s Gluestack
layer (`ThemeProvider.js` + the `@gluestack-ui/*` packages) — nothing in that project actually
renders a Gluestack component either, it only ever fed Gluestack a `colorMode` nothing reads, so it
was left out as inert plumbing rather than carried over for parity's sake. Added
`.claude/agents/frontend.md` (this project's fifth agent persona) scoped to what actually exists
here (auth + Settings, no scraper/jobs/admin surface).

**Deliberately bootstrapped to match [[askmycrawl-project]]'s conventions** (`C:\Users\lidor\
Desktop\ask-my-crawl`) — same NestJS Nest-CLI monorepo shape (`apps/` + `libs/`), same clean/
hexagonal API/Application/Infrastructure layering with string/Symbol DI tokens, same Gateway
auth-proxy pattern, same per-service `devops/<service>/docker-compose.yml` via `include:`, same
generic `libs/auth-kernel`/`libs/otel`/`libs/kafka-client` (ported near-verbatim — generic infra,
not project-specific), same Expo Router + Redux Toolkit + services-layer frontend convention, same
theme/component conventions as of the fifth revision note above, same `.claude/agents` +
`.claude/memory` setup. Differs deliberately where the project's actual shape differs: `UserRole`
has exactly one value (`'user'`, no admin/role system — nothing needs one), Auth Service's port is
never published at all (stricter than askmycrawl's own documented debt), no JWT-gated Grafana proxy
(Grafana is published directly — Tailscale is already the boundary), no Gluestack dependency on the
frontend (see fifth revision note). See [[feedback_gateway_only_service_access]].

**Where things live**:
- `.claude/agents/{backend,devops,frontend,testing,docs}.md` — real Claude Code subagent
  definitions for agent-teams work on this project. `docs` (added 2026-09-06, at the user's request
  after flagging over-dense code comments) owns keeping `docs/specs/*.md`/`CLAUDE.md`/READMEs/the
  other agent files in sync with current reality, owns the Mermaid diagrams in
  `docs/specs/architecture.md`, and trims code comments down to terse — `backend.md`/`devops.md`
  both explicitly hand off to it rather than self-policing comment density. See
  [[feedback_avoid_dense_code_comments]].
- `docs/specs/` — `services.md`, `event-schemas.md`, `architecture.md` (topology + sequence
  diagrams, Mermaid).
- Root `CLAUDE.md` — the single source of truth for architecture/commands, kept dense on purpose
  (matches [[askmycrawl-project]]'s CLAUDE.md style).

**Hosting**: the user's personal PC, connected to their phone via Tailscale — `devops/.env`'s
`GATEWAY_PUBLIC_URL` (port 8000, baked into the frontend's build) must be a Tailscale-reachable
address (MagicDNS name or Tailscale IP), not `localhost`, or the phone can't reach it.

See [[feedback_commits_need_explicit_approval]] — commits on this repo need explicit sign-off, not
automatic after finishing a chunk of work (this is a global rule, not specific to this project, but
applies here too).
