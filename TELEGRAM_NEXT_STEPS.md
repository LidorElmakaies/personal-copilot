# Telegram feature — context + planned follow-ups

This file exists so a fresh Claude session (or a human) can pick this feature up with zero
re-derivation. It covers: how the design got to its current shape, what's actually implemented
right now, the git/branch situation, and exactly what the user wants changed next and why. Nothing
below is implemented yet under "Planned follow-ups" — that part is intent, not current behavior
(current behavior lives in `docs/specs/services.md`/`event-schemas.md`/`architecture.md`, which
this file must not be treated as a replacement for).

## Summary of the chat session that produced this

One long session, start to finish, on `dev`. Roughly in order:

1. User asked for a new microservice to send/receive WhatsApp messages, with a menu the user could
   answer by number or button, plus custom free-text messages — asked for research first, not
   immediate code.
2. Claude researched WhatsApp Cloud API vs. the unofficial `Baileys` library (cost, business
   verification, ban risk, the 24h-customer-initiated-window problem for proactive messages) and
   asked the user to pick a direction via two multiple-choice questions (integration + menu style).
3. Mid-answer, the user pivoted: "what other SMS services can I use" instead. Claude explained real
   carrier SMS is plain-text-only — no buttons exist in that protocol at all — and offered Telegram
   as the practical way to get the originally-wanted native-button UX for free. User picked Telegram
   plus native inline buttons.
4. User then asked a privacy question: does Telegram keep chat history, could it leak, given they
   planned to log real spending figures in it. Claude explained bot chats are cloud-stored, not
   end-to-end encrypted (Secret Chats explicitly exclude bots), and offered "keep detail in Postgres,
   Telegram only shows summaries" as a mitigation. User explicitly chose to accept the risk and
   store real figures directly in Telegram text — a conscious tradeoff, not an oversight.
5. Claude built the first working version: a new `apps/telegram` NestJS service (long-polling
   `grammy` bot), gated by a single `TELEGRAM_OWNER_CHAT_ID` env var, decoupled from the rest of the
   system via two new Kafka topics, full docs sync across `CLAUDE.md`/`docs/specs/`/agent files.
6. User said they also wanted their girlfriend to use it. Claude generalized the single owner id
   into a comma-separated `TELEGRAM_ALLOWED_CHAT_IDS` allowlist, `userId`/`chatId`-aware payloads,
   full re-sync of docs.
7. User then said they didn't like manually hunting down and exchanging raw numeric Telegram chat
   IDs, and asked for something different: allow any chat to message the bot, gated by a
   username/password login typed into the chat, with the resulting chat id saved against the user's
   account. Claude flagged that this design turns the bot into a public, unauthenticated
   login-attempt surface against Auth Service (this project's own non-negotiable says to stop and
   ask before building exactly that), and offered a safer alternative: a one-time linking code
   generated from the already-authenticated app instead of a typed password. User picked that.
8. Claude built the full account-linking redesign: dropped the allowlist entirely, added
   `telegram_links`/`telegram_link_codes` Postgres tables, a `POST /telegram/link-code` endpoint on
   Gateway (direct synchronous HTTP call through to `apps/telegram`), and a "Get linking code" /
   "Open Telegram" flow in the frontend Settings screen. Full docs re-sync again.
9. Several follow-up questions from the user about the resulting design — what a Telegram "chat id"
   even is, why a phone number can't be used instead (Telegram's Bot API forbids messaging a phone
   number cold — a chat must be initiated by the user first, by design, as anti-spam), how to open a
   chat with your own bot, how someone actually retrieves their own chat id in practice.
10. User then asked for a different transport entirely: frontend → Gateway over HTTP, but Gateway
    to `apps/telegram` over Kafka (not direct HTTP), with `apps/telegram` building the *complete*
    deep-link URL itself (since it alone knows the bot's username) and Gateway relaying the result
    back to the frontend over the existing WebSocket rather than the HTTP response. Claude
    implemented this exactly: removed `apps/telegram`'s HTTP surface entirely, added Gateway's first
    Kafka producer+consumer, added `telegram.link.requested`/`telegram.link.created` topics, wired
    `IRealtimeConnectionService.pushToUser` (previously-unused plumbing) as the actual delivery
    path, removed `TELEGRAM_BOT_USERNAME` from the frontend/devops entirely since it became
    unnecessary. Full docs re-sync a third time.
11. User asked follow-up questions about this new flow (does Gateway talk to `apps/telegram`
    directly — no, only via Kafka now; why does the frontend build need the bot username — it
    doesn't, not anymore).
12. User asked for all of `apps/telegram`'s static bot-facing text to be pulled into a translatable
    file. Claude built `src/i18n/` (`.ts` locale modules rather than raw `.json`, to avoid this
    project's build pipeline needing new asset-copying wiring for JSON files) keyed off Telegram's
    own per-message `language_code`, so each linked person automatically sees replies in their own
    Telegram client's language.
13. User asked for the locale-selection logic specifically to be a `switch` statement with a
    visible `default: return en` rather than a map lookup — cosmetic refactor, applied as asked.
14. User asked a few clarifying "why" questions about small implementation choices (why `?? en[key]`
    exists even though `default` already returns English — it's the per-key fallback for a
    *partially* translated locale, not a duplicate of the default case; why link codes are stored in
    Postgres at all rather than something else).
15. That last question turned into real feedback rather than just a question: the user pointed out
    link codes will "stay forever" in Postgres (true — nothing purges them) and asked for Redis
    instead, and separately asked for the `telegram_links` table to be replaced with a single column
    on `auth`'s existing `users` table. Given end of session (user wanted to sleep), Claude did not
    implement either change — instead produced this file, plus a suggested branch name
    (`feature/telegram-linking`) and two commit messages (one for what the user had already staged
    by hand, one for the remaining untracked files), explicitly not running any git commands itself
    per the user's instruction that only they commit.

## How this feature got to its current shape

The ask started as "add a microservice that receives/sends WhatsApp messages, with a menu the user
can reply to by number or button." That went through several real pivots, each for a concrete
reason — worth knowing so nobody re-proposes an option already ruled out:

1. **WhatsApp Cloud API vs. Baileys (unofficial)** — researched both. Cloud API requires business
   verification and, critically, can't message the user *first* outside a 24h customer-initiated
   window without a paid/approved template — bad fit for "the app proactively pings me." Baileys
   (unofficial, acts as a real linked device) has no such restriction but carries real, unappealable
   ban risk. Discussed both; before settling, the direction changed entirely (next point).
2. **Pivot to "what other SMS services" → discovered real SMS can't do buttons at all** — classic
   carrier SMS (Twilio etc.) is plain-text-only; "tap a button" is a rich-messaging feature (Telegram,
   WhatsApp, RCS), not something SMS protocols support. This is what led to Telegram.
3. **Telegram Bot API chosen**: free, official, no ban risk for personal use, native inline-keyboard
   buttons (exactly the "select 1 / select 2" UX originally wanted), and it can message the user
   first with no restriction — unlike Cloud API's 24h window problem.
4. **Privacy check on Telegram itself**: confirmed bot chats are *not* end-to-end encrypted (Secret
   Chats are a device-to-device-only feature; bots are explicitly excluded from them). User was
   informed and explicitly accepted storing real data (e.g. expense figures) directly in Telegram
   chat text — that's a conscious accepted tradeoff, not an oversight.
5. **First working version: a static allowlist** — `TELEGRAM_OWNER_CHAT_ID` (later
   `TELEGRAM_ALLOWED_CHAT_IDS`, comma-separated, to support two people). Any chat not on the list
   was dropped before reaching application code, since a bot's username is publicly discoverable.
6. **Pivoted away from the allowlist** — manually hunting down and sharing raw numeric Telegram
   chat IDs between two people was the exact friction the user wanted gone. Replaced with: anyone
   can message the bot, but it does nothing until a chat redeems a one-time code tied to a real app
   account (generated from the already-authenticated frontend). This is the current design.
7. **Initial linking transport was a direct synchronous HTTP call**, Gateway → `apps/telegram`
   (`POST /link-codes`). The user explicitly asked to redo this as a fully async flow instead —
   see next point — specifically to exercise the Kafka + WS-push plumbing this project already has
   sitting unused, and so `apps/telegram` needs no HTTP surface at all, not even for Gateway.
8. **Current linking transport: HTTP → Kafka → Kafka → WS**, entirely async (below). This was a
   deliberate architecture request, not a default — don't "simplify" it back to synchronous HTTP
   without re-reading why it was changed.
9. **i18n added**: all bot-facing text extracted from inline strings into
   `apps/telegram/src/i18n/`, keyed off Telegram's own per-message `language_code` (no stored user
   preference needed). User asked for the locale lookup to be a `switch` with a visible
   `default: return en` branch rather than a map lookup — purely a readability preference, already
   applied.

## Current architecture (as implemented, on this branch)

**`apps/telegram`** — no HTTP surface at all (not even for Gateway). A long-polling `grammy` bot,
internal-only.
- Linking: subscribes to `telegram.link.requested` (`{ userId }`), mints an 8-char single-use code
  (5-min TTL) into `telegram_link_codes` (Postgres), builds `https://t.me/<bot>?start=<code>`
  itself via the Bot API's `getMe()` (so nothing else needs to know the bot's username), publishes
  `{ userId, code, url, expiresAt }` on `telegram.link.created`. An unlinked chat's text is tried as
  a code (`TelegramInboundService`); success writes a row to `telegram_links` (`chatId` ↔ `userId`,
  at most one each way).
- Messaging (once linked): subscribes to `telegram.message.send` (`{ text, buttons?, userId? }`,
  `userId` omitted = broadcast to everyone linked), publishes `telegram.message.received`
  (`{ kind: 'button'|'text', userId, data|text, receivedAt }`) for linked chats only. No feature
  consumes this yet — generic plumbing, same status as Gateway's WS layer always was.
- `src/i18n/messages.ts` — `t(key, languageCode)`, `switch` over `languageCode` with
  `default: return en`; `src/i18n/locales/en.ts` is the only locale that exists today.

**`apps/gateway`** — new `src/telegram-proxy/` module: `POST /telegram/link-code` (first route in
the app using `JwtAuthGuard`, not just `AUTH_TOKEN_SERVICE` directly) publishes
`telegram.link.requested` and returns `202` immediately — no body. A separate consumer
(`TelegramLinkCreatedConsumer`) subscribes to `telegram.link.created` and pushes it to the
requesting user's own WS connection as a `telegram:link-code` event via the pre-existing
`IRealtimeConnectionService.pushToUser` (first real feature to use it). This is the app's first use
of Kafka in either direction.

**`libs/kafka-client`** — gained its first consumer (`IEventConsumer`/`KafkajsEventConsumer`),
symmetric to the pre-existing producer.

**`libs/kafka-contracts`** — four topics total: `telegram.link.requested`, `telegram.link.created`,
`telegram.message.send`, `telegram.message.received`.

**`frontend`** — Settings screen: "Get linking code" button dispatches a thunk that POSTs and then
waits; the actual `{ code, url, expiresAt }` arrives via a `telegram:link-code` WS event a
`useEffect` in the Settings screen listens for directly (`socketService.getSocket()`), dispatching
a plain `telegramLinkCodeReceived` action into `telegramSlice`. State machine: `idle → requesting →
waiting → succeeded|failed`. No `TELEGRAM_BOT_USERNAME` env var anywhere (frontend or devops) —
`apps/telegram` builds the full deep link itself.

**Known, accepted tradeoff**: if the user's WS connection is down at the exact moment
`telegram.link.created` arrives, `pushToUser` returns `false` and that code is just never
delivered (not lost — usable for its full 5 minutes — just invisible until they tap "Get linking
code" again). This is intentional, documented in `architecture.md`'s linking sequence diagram.

## Git / branch situation

All of the above was built in one long session directly on `dev` (this project's normal working
branch, not `main`). Given how much the design churned mid-flight (three real architecture pivots
for the linking transport alone, listed above), the recommendation handed to the user was: don't
keep piling more churn onto `dev` directly — cut a dedicated branch for this feature first.

**Recommended branch name**: `feature/telegram-linking`, cut from `dev` at the point where all the
work below was already staged/committed:

```bash
git checkout -b feature/telegram-linking dev
```

Two commits were prepared (text handed to the user, **not executed by Claude** — the user commits,
Claude only drafts messages):

1. Everything already `git add`-ed by the user by hand — the full feature as described above
   (telegram service, gateway proxy, Kafka libs/contracts, devops wiring, docs, frontend).
2. The handful of files still untracked at that point — `telegram-link.service.ts`,
   `telegram-link-code-repository.interface.ts`, `infrastructure/postgres/*`, `models/*` — plus
   this file itself.

If the branch hasn't been created yet when you're reading this, do that first, *then* make the two
commits on it — don't commit this churn onto `dev` directly. Once the two storage changes below are
also done and the feature feels settled, that's the point to open a PR back into `dev` (or merge
directly, per however this repo normally integrates branches — no PR workflow has been established
here yet, it's a single-user project).

## Planned follow-ups (not implemented — the actual "next steps")

### 1. Link codes should live in Redis, not Postgres

**Problem right now**: `telegram_link_codes`
(`backend/apps/telegram/src/infrastructure/postgres/entities/telegram-link-code.entity.ts`) never
deletes a row — a code that's redeemed, or one that just expires unused, sits in the table forever.
Nothing purges it. Over time this is an unbounded, permanently-growing table of data that stops
mattering the moment it's used or expires.

**Wanted change**: move link codes out of Postgres entirely and into Redis, using Redis's native
key expiry (`EXPIRE`/`SETEX`, e.g. `SET link:<code> <userId> EX 300`) instead of the current
`expiresAt < new Date()` check in `telegram-link.service.ts`'s `redeemCode`. Redis self-cleans —
no manual purge job, no cron, no accumulating dead rows ever.

**Not yet decided / worth weighing explicitly in the next session, not assuming**: Redis is *new*
infrastructure for this stack — `devops/` has no Redis service today (this project's Postgres and
Kafka are both already-running shared infra per the devops "reuse what exists" convention; Redis
would be the first exception to that, not a reuse). Real costs to weigh: a new
`devops/redis/docker-compose.yml` service, a new client dependency in `backend/package.json` (e.g.
`ioredis`), new wiring in `apps/telegram`'s module (a new `ITelegramLinkCodeRepository`
implementation backed by Redis instead of TypeORM), and a new env var (`REDIS_URL` or similar) in
`backend/.env.example`/`devops/docker.env`. Whether that's worth it for one small ephemeral table
vs. e.g. just adding a scheduled cleanup query against the existing Postgres table (`DELETE FROM
telegram_link_codes WHERE expires_at < now()`, run periodically) is the actual tradeoff to make
explicitly. The user has stated a preference for Redis; this note exists so that preference is
implemented with the real cost seen, not glossed over.

### 2. Drop the `telegram_links` table — add one column to `auth`'s `users` table instead

**Wanted change**: instead of a separate `telegram_links` table living in `apps/telegram`'s own
Postgres access (`chatId` ↔ `userId` mapping), add a single column (e.g. `telegram_chat_id`,
nullable, unique) directly onto the `users` table that `apps/auth` already owns
(`backend/apps/auth/src/infrastructure/postgres/entities/user.entity.ts`).

**The real design question this opens, not yet resolved**: `apps/auth` is currently the *sole*
owner of all reads/writes to `users` — no other service touches that table, directly or otherwise.
`apps/telegram` would need some way to set that column when a code is redeemed, and to read it on
every single inbound Telegram message (to decide "is this chat linked, and to whom"). Options,
roughly in order of how well they fit this project's existing conventions:

- **(a) Kafka event, `auth` applies the write.** `apps/telegram` publishes a
  `telegram.link.confirmed`-shaped event (or the existing `telegram.link.created` gains a consumer
  on the `auth` side too) that `apps/auth` consumes and applies to its own `users` row. Keeps
  `auth` as the only writer — same decoupled shape as everything else this feature already does.
  Doesn't solve the *read* side on its own (see below) — `auth` becoming the source of truth for
  the mapping doesn't automatically give `apps/telegram` a fast way to check it per-message.
- **(b) `apps/telegram` calls a new internal `auth` endpoint directly (HTTP).** Reintroduces a
  synchronous HTTP dependency `apps/telegram` currently has zero of — it has *no* HTTP surface at
  all right now (see `docs/specs/services.md#telegram`), which was itself a deliberate simplicity
  the earlier HTTP→Kafka pivot (point 7/8 above) was specifically about achieving. This option
  would partially undo that.
- **(c) `apps/telegram` writes directly into `auth`'s `users` table** via its own second TypeORM
  connection pointed at the same table. Technically simplest, but two services owning writes to
  the same entity is exactly the kind of cross-service coupling this project's hexagonal layering
  (`.claude/agents/backend.md`) has avoided everywhere else so far — would be a deliberate,
  named exception to that convention, not something to back into silently.

**The harder part is the read path, not the write.** Every single inbound Telegram message needs
an instant "is this `chatId` linked, and to which `userId`" answer
(`TelegramInboundService.handle`, today backed by a fast local Postgres lookup in
`apps/telegram`'s own tables) — that has to stay a fast local lookup, not a network round trip (an
HTTP call, or worse, a request/reply-over-Kafka round trip) on every single incoming message. If
`auth`'s `users` table becomes the sole source of truth for the mapping, `apps/telegram` still
needs *some* fast local read path — it can't block every inbound Telegram message on calling out to
another service synchronously.

A plausible resolution direction (not a decision — pick it apart before implementing): **`auth`
stays the single writer of the durable `telegram_chat_id` column, but publishes a link-changed
event whenever it changes; `apps/telegram` consumes that into its own small local read-optimized
table (effectively the same shape as today's `telegram_links`, but now populated from `auth`'s
events instead of being telegram's own source of truth).** This keeps `auth` as sole owner of the
durable data (satisfying the "single column on the real users table" goal) while keeping
`apps/telegram`'s hot path exactly as fast and dependency-free as it is today. Whether this is
worth the added event-plumbing versus just accepting option (c)'s direct-table-access simplicity
for a single-user-scale personal project is the actual call to make next session — lay out both
concretely, then ask the user rather than picking silently, since it's a real architectural
tradeoff with no obviously-correct answer at this project's scale.

## Where this leaves things

None of "Planned follow-ups" is implemented — the currently-staged/committed code still uses the
separate `telegram_link_codes`/`telegram_links` Postgres tables described in
`docs/specs/services.md#telegram` and `event-schemas.md`. Update those two files (and
`architecture.md`'s diagrams) and delete this file once either change actually ships — per this
project's own docs convention (`.claude/agents/docs.md`), `docs/specs/` must only ever describe
current behavior, never planned/future behavior, which is exactly why this content lives here and
not there in the meantime.
