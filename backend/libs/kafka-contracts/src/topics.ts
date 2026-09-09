// This project's Kafka topics. Add one here, and to devops/kafka/docker-compose.yml's kafka-init,
// the same change a topic's first producer/consumer ships in.
export const KAFKA_TOPICS = {
  /** Gateway asks the telegram service to mint a linking code for a user — see
   * telegram-link-events.ts. */
  TELEGRAM_LINK_REQUESTED: 'telegram.link.requested',
  /** The telegram service reports a minted code/URL back to Gateway, which pushes it to the
   * requesting user's WS connection — see telegram-link-events.ts. */
  TELEGRAM_LINK_CREATED: 'telegram.link.created',
  /** Any service asks the telegram service to send/menu a message — see telegram-messages.ts. */
  TELEGRAM_MESSAGE_SEND: 'telegram.message.send',
  /** The telegram service publishes an incoming reply (free text or a button tap) for whichever
   * feature is listening — see telegram-messages.ts. */
  TELEGRAM_MESSAGE_RECEIVED: 'telegram.message.received',
} as const;
