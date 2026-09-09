# Services

Three NestJS apps in `backend/apps/`, one shared event-bus lib pair, one frontend. See
`architecture.md` for the topology diagram.

## gateway

The only backend service reachable from outside the Docker network (published to the host,
reachable from your phone over Tailscale). HTTP + WebSocket.

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` — pure pass-through to
  Auth Service, no guard (that's how you get a token in the first place). No `GET /me` — there's
  nothing left for it to return that the client can't already decode from its own access token
  (see `apps/auth`'s note below).
- `src/realtime/` — Socket.IO at path `/ws` (token in the handshake's `auth.token`, verified the
  same way as the HTTP guard). Generic plumbing: no feature pushes anything over it yet.
  `IRealtimeConnectionService.pushToUser(userId, event, payload)` is the entry point a future
  feature module injects (import `RealtimeModule`) to reach a specific user's live connection —
  returns `false`, not an error, if they have none open. In-memory connection store, single
  Gateway replica only (this project's actual scale) — a Redis-backed store (Socket.IO's official
  Redis adapter) is the upgrade path if that ever changes.
- `src/telegram-proxy/` — `POST /telegram/link-code`, guarded by `JwtAuthGuard` (the first route in
  this app to use it). Doesn't call `apps/telegram` directly: publishes `TELEGRAM_LINK_REQUESTED`
  (`{ userId }`, from `@CurrentUser()`) and returns `202` immediately. When `apps/telegram` replies
  on `TELEGRAM_LINK_CREATED`, `TelegramLinkCreatedConsumer` pushes it to that user's WS connection
  as a `telegram:link-code` event (`{ code, url, expiresAt }`) via `IRealtimeConnectionService
  .pushToUser` — a no-op, not an error, if they have no connection open at that moment. This app's
  first use of Kafka in either direction.
- CORS is permissive (`origin: true`, reflects any origin) on both HTTP and the WS handshake — the
  frontend's web build runs on a different origin than Gateway during dev, and Tailscale is this
  project's actual access boundary. Revisit before Gateway is ever reachable outside the Tailnet.

## auth

HTTP, internal-only — never published to the host, only Gateway calls it.

- `POST /auth/register` — `{ email, password }` → `{ access_token, refresh_token }`.
- `POST /auth/login` — same shape.
- `POST /auth/refresh` — `{ refresh_token }` → new `{ access_token, refresh_token }` (rotates; the
  old refresh token is revoked regardless of outcome).
- `POST /auth/logout` — `{ refresh_token }` → revokes it.

None of these return a `user` object — the access token itself carries `{ sub, role, email }`
(`@app/auth-kernel`'s `JwtPayload`), so there's nothing left for a `GET /me` endpoint to return
that the client can't already decode. This only works because the project has no profile-editing
feature; if one's ever added, a 15-min-stale email in an already-issued token becomes a real
tradeoff to reconsider, not a non-issue.

Postgres via TypeORM (`users`, `refresh_tokens`), password_hash = SHA256(`PASSWORD_PEPPER` + salt +
plaintext). Access tokens: 15-min TTL, `{ sub, role, email }` payload. `UserRole` has exactly one
value (`'user'`) — no admin/role system in this project.

Refresh tokens are stored as a plain SHA-256 hash (no salt/pepper) — sufficient since a refresh
token is already a high-entropy random value, not human-guessable like a password, so this only
guards against a raw DB leak, not brute force. `refresh` always revokes the used token first, then
issues a new pair, so a stolen-and-replayed refresh token only ever works once.

## telegram

Internal-only, and unlike every other service here, **no HTTP surface at all** — not even for
Gateway. A long-polling bot (`grammy`, outbound-only — no inbound webhook needed) that accepts
messages from any Telegram chat; every other interaction, including the linking round trip, is
Kafka.

**Linking** — anyone can message the bot, but an unlinked chat can't do anything except redeem a
one-time code:

- Subscribes to `KAFKA_TOPICS.TELEGRAM_LINK_REQUESTED` (`{ userId }`, published by Gateway after
  its own `JwtAuthGuard` verifies who's asking). Mints an 8-character code (`telegram_link_codes`
  table, 5-minute TTL, single-use) and builds a ready-to-open deep link — `https://t.me/<bot
  username>?start=<code>` — using its own username from the Bot API's `getMe()`, so no other
  service or client needs to know it. Publishes both as `{ userId, code, url, expiresAt }` on
  `KAFKA_TOPICS.TELEGRAM_LINK_CREATED` for Gateway to relay onward.
- Any text an unlinked chat sends is tried as that code (`TelegramInboundService`); a Telegram deep
  link arrives as `/start <code>` and is unwrapped the same way. A valid, unused, unexpired code
  links that `chatId` to the code's `userId` (`telegram_links` table, at most one row per user and
  per chat — relinking replaces the old row) and the bot confirms it in-chat. Anything else gets a
  "send your linking code" reply.
- This is the only thing standing between a publicly discoverable bot username and open access to
  Auth Service/other users' data: nothing reaches the message topics below, and no feature is ever
  invoked, for a chat that hasn't redeemed a code from a real app account.

Every user-facing bot message is looked up from `src/i18n/messages.ts`'s `t(key, languageCode)`
rather than inlined — `languageCode` is Telegram's own per-update `from.language_code`, so each
person gets replies in their own client's language automatically, no stored preference needed.
`src/i18n/locales/en.ts` is the fallback locale (every key must exist there); add a language by
dropping in `locales/<IETF tag>.ts` with a matching `Partial<typeof en>` shape and registering it
in `messages.ts` — an untranslated key silently falls back to English.

**Once linked**, decoupled from every other service via Kafka, not a direct call:

- Subscribes to `KAFKA_TOPICS.TELEGRAM_MESSAGE_SEND` — any service publishes a
  `TelegramSendMessage` (`{ text, buttons?, userId? }`) to message someone. `buttons` renders as a
  native inline keyboard, one button per row; omit it for plain text. `userId` targets that user's
  linked chat (a no-op, logged, if they have none); omit it to broadcast to everyone linked.
- Publishes to `KAFKA_TOPICS.TELEGRAM_MESSAGE_RECEIVED` on every reply from a linked chat, tagged
  with the sender's `userId` — a button tap (`{ kind: 'button', userId, data }`, `data` is the
  tapped button's own `callback_data`, echoed verbatim) or typed text (`{ kind: 'text', userId,
  text }`).

See `event-schemas.md` for the full payload shapes. No feature consumes either topic yet — this is
generic send/receive plumbing, the same status as Gateway's WS layer.

## frontend

Expo Router app. `(auth)/login`, `(auth)/register`, `(tabs)/index` (Settings — theme toggle,
logged-in account, Telegram linking, live connection status, logout). Talks only to Gateway
(`EXPO_PUBLIC_GATEWAY_ORIGIN`, baked in at build time, required — `src/config/urls.js` throws at
load if it's unset) — never Auth Service or any other backend service directly.

`telegramSlice.generateTelegramLinkCode` calls `POST /telegram/link-code`, which only acks (202) —
the actual `{ code, url, expiresAt }` arrives later as a `telegram:link-code` WS event (pushed by
Gateway once `apps/telegram` reports it back over Kafka), handled by a listener Settings registers
via `socketService.getSocket()`, dispatching the plain `telegramLinkCodeReceived` action. State
(ephemeral, not persisted) moves `idle` → `requesting` → `waiting` → `succeeded`/`failed`. Settings
shows the code plus an "Open Telegram" button (`Linking.openURL(telegram.url)`) once it arrives —
the code can always be typed into the chat by hand instead.

Themed via a three-layer pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`) and shared
components (`GlowCard`, `GradientButton`, `InputField`, `SpaceBackground`, `ConnectionStatus`) —
see `.claude/agents/frontend.md` for the full convention and why there's no Gluestack layer here.

`src/services/` is split by transport: `http/` (fetch-based calls — `authService`, `telegramService`)
and `ws/` (`socketService`, a single shared Socket.IO connection). `wsSlice`'s `connectWebSocket`/
`disconnectWebSocket` thunks open/close it whenever `authSlice.accessToken` changes
(`app/_layout.js`'s `RealtimeConnectionManager`) — generic plumbing, same as Gateway's `/ws`.
Settings' `telegram:link-code` listener (registered directly via `socketService.getSocket()` in a
`useEffect`, re-attached whenever `wsSlice.status` changes) is the first feature-specific one —
the pattern any future feature follows rather than opening a second connection.

`authSlice` stores the `refreshToken` that register/login return but doesn't consume it yet — no
refresh thunk exists, since the 15-min access token is short enough that logging in again is an
acceptable v1.

## libs/auth-kernel

Shared JWT sign/verify (`IJwtService`/`JsonWebTokenService`, the only class allowed to import
`jsonwebtoken`), the higher-level `IAuthTokenService`/`AuthTokenService` used by every guard,
`JwtAuthGuard`, and the `CurrentUser` param decorator. Used by both `apps/auth` (signs, on
login/register) and `apps/gateway` (verifies — the WS handshake uses `AUTH_TOKEN_SERVICE` directly;
`telegram-proxy`'s `POST /telegram/link-code` is the first route to use `JwtAuthGuard` itself).

## libs/kafka-contracts / libs/kafka-client

`kafka-client` is generic Kafka plumbing — `IEventPublisher`/`KafkajsEventPublisher` (producer) and
`IEventConsumer`/`KafkajsEventConsumer` (consumer), neither aware of any topic name. `kafka-contracts`
is this project's own topics/message shapes; `apps/telegram` produces/consumes all four topics
today, `apps/gateway` produces `TELEGRAM_LINK_REQUESTED` and consumes `TELEGRAM_LINK_CREATED` — see
`event-schemas.md`.
