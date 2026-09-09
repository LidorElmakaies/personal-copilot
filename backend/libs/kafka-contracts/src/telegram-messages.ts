/** One inline-keyboard button — `data` round-trips back verbatim on TELEGRAM_MESSAGE_RECEIVED. */
export interface TelegramButton {
  label: string;
  /** Telegram caps callback_data at 64 bytes — keep it a short opaque id, not a payload. */
  data: string;
}

/** Published to KAFKA_TOPICS.TELEGRAM_MESSAGE_SEND by any service that wants to message someone. */
export interface TelegramSendMessage {
  text: string;
  /** Rendered as an inline keyboard, one button per row. Omit for a plain text message. */
  buttons?: TelegramButton[];
  /** The app user to message (their linked Telegram chat is resolved internally). Omit to
   * broadcast to everyone currently linked. A `userId` with no linked chat is a silent no-op. */
  userId?: string;
}

/** Published to KAFKA_TOPICS.TELEGRAM_MESSAGE_RECEIVED — either a button tap or free-typed text,
 * always from a chat already linked to `userId` (an unlinked chat never reaches this topic; it's
 * handled as a link-code attempt instead — see services.md#telegram). */
export type TelegramReceivedMessage =
  | { kind: 'button'; userId: string; data: string; receivedAt: string }
  | { kind: 'text'; userId: string; text: string; receivedAt: string };
