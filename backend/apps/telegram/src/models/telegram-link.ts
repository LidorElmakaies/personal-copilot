/** One app user's linked Telegram chat — at most one of each per user and per chat. */
export interface TelegramLink {
  userId: string;
  chatId: string;
  linkedAt: Date;
}

/** A one-time code minted for a specific user, waiting to be redeemed from their Telegram chat. */
export interface TelegramLinkCode {
  code: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}
