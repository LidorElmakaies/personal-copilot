# Event schemas

`backend/libs/kafka-contracts/src/topics.ts` defines four topics today: a link-code request/reply
pair between `apps/gateway` and `apps/telegram`, and a message send/receive pair usable only once a
chat is linked to an app user (see `services.md#telegram` — an unlinked chat's messages never reach
Kafka at all). `devops/kafka/docker-compose.yml`'s `kafka-init` creates all four — that list, this
file, and `topics.ts` must always name the exact same topics.

Adding a new topic: declare it in `topics.ts`, add its consumer group (if any) to
`consumer-groups.ts`, add it to `kafka-init`, and document its payload shape here in its own
section, the same shape as the ones below.

## `telegram.link.requested`

Published by `apps/gateway`'s `telegram-proxy` on `POST /telegram/link-code` (after its own
`JwtAuthGuard` verifies the caller); consumed by `apps/telegram`
(`KAFKA_CONSUMER_GROUPS.TELEGRAM_LINK_REQUEST_CONSUMER`).

```ts
interface TelegramLinkRequested {
  userId: string;
}
```

## `telegram.link.created`

Published by `apps/telegram` once it mints a code for a `TELEGRAM_LINK_REQUESTED`; consumed by
`apps/gateway` (`KAFKA_CONSUMER_GROUPS.GATEWAY_TELEGRAM_LINK_CONSUMER`), which pushes it to that
user's WS connection as a `telegram:link-code` event — a no-op, not an error, if they have none
open at that moment.

```ts
interface TelegramLinkCreated {
  userId: string;
  code: string;
  url: string; // https://t.me/<bot username>?start=<code> — apps/telegram builds this itself
  expiresAt: string;
}
```

## `telegram.message.send`

Published by any service that wants to message someone via Telegram; consumed by `apps/telegram`
(`KAFKA_CONSUMER_GROUPS.TELEGRAM_SEND_CONSUMER`).

```ts
interface TelegramButton {
  label: string;
  data: string; // Telegram caps callback_data at 64 bytes — a short opaque id, not a payload
}

interface TelegramSendMessage {
  text: string;
  buttons?: TelegramButton[]; // native inline keyboard, one button per row; omit for plain text
  userId?: string; // resolved to that user's linked chat; omit to broadcast to everyone linked
}
```

## `telegram.message.received`

Published by `apps/telegram` for every reply from a chat already linked to a `userId` (see
`services.md#telegram` for how linking works — anything from an unlinked chat is handled as a
link-code attempt instead of reaching this topic); consumed by whichever feature cares.

```ts
type TelegramReceivedMessage =
  | { kind: 'button'; userId: string; data: string; receivedAt: string } // data is the tapped button's callback_data
  | { kind: 'text'; userId: string; text: string; receivedAt: string };
```
