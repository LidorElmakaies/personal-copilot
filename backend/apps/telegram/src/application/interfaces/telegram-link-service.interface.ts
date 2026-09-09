export interface GeneratedLinkCode {
  code: string;
  /** Ready-to-open t.me/<bot>?start=<code> deep link. */
  url: string;
  expiresAt: Date;
}

/** Implemented by TelegramLinkService. Owns the userId<->chatId mapping and its one-time codes. */
export interface ITelegramLinkService {
  generateCode(userId: string): Promise<GeneratedLinkCode>;
  /** Redeems a one-time code from `chatId`, linking it to the code's user. Null if the code is
   * unknown, already used, or expired. */
  redeemCode(code: string, chatId: string): Promise<string | null>;
  findUserIdByChatId(chatId: string): Promise<string | null>;
  findChatIdByUserId(userId: string): Promise<string | null>;
  allLinkedChatIds(): Promise<string[]>;
}
