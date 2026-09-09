// One id per consuming service — avoids a typo in main.ts silently creating a second group.
export const KAFKA_CONSUMER_GROUPS = {
  /** apps/telegram's own subscription to TELEGRAM_LINK_REQUESTED. */
  TELEGRAM_LINK_REQUEST_CONSUMER: 'telegram-link-request-consumer',
  /** apps/gateway's own subscription to TELEGRAM_LINK_CREATED. */
  GATEWAY_TELEGRAM_LINK_CONSUMER: 'gateway-telegram-link-consumer',
  /** apps/telegram's own subscription to TELEGRAM_MESSAGE_SEND. */
  TELEGRAM_SEND_CONSUMER: 'telegram-send-consumer',
} as const;
