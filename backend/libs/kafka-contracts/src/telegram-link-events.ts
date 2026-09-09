/** Published to KAFKA_TOPICS.TELEGRAM_LINK_REQUESTED by Gateway, on POST /telegram/link-code. */
export interface TelegramLinkRequested {
  userId: string;
}

/** Published to KAFKA_TOPICS.TELEGRAM_LINK_CREATED by apps/telegram once a code is minted; Gateway
 * consumes this and pushes it to `userId`'s WS connection (a no-op if they have none open — the
 * code still exists, they just won't see it until they retry from a connected session). */
export interface TelegramLinkCreated {
  userId: string;
  code: string;
  /** Ready-to-open deep link (t.me/<bot>?start=<code>) — apps/telegram builds this itself since it
   * already knows its own bot username (Bot API's getMe()), so no client needs to know it too. */
  url: string;
  expiresAt: string;
}
