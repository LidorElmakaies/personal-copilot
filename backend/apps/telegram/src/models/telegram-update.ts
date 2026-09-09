/** A raw update from Telegram — identity not resolved yet, see TelegramInboundService.
 * `languageCode` is the sender's Telegram client language (IETF tag, e.g. 'en'), used to pick
 * which reply locale to reply in — see i18n/messages.ts. */
export type TelegramUpdate =
  | { kind: 'button'; chatId: string; data: string; languageCode?: string }
  | { kind: 'text'; chatId: string; text: string; languageCode?: string };
