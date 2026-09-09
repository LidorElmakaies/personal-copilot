import type { TelegramButton } from '@app/kafka-contracts';
import type { TelegramUpdate } from '../../models/telegram-update';

/** Implemented by GrammyTelegramClient — the only class allowed to import `grammy`. */
export interface ITelegramClient {
  /** This bot's own @username (no leading @), via the Bot API's getMe() — used to build deep
   * links (t.me/<username>?start=<code>) without any client needing to know it separately. */
  getBotUsername(): Promise<string>;
  sendText(chatId: string, text: string): Promise<void>;
  /** One button per row — see TelegramButton's callback_data size note. */
  sendMenu(chatId: string, text: string, buttons: TelegramButton[]): Promise<void>;
  /** Registers the single handler for every incoming update. Replaces any prior handler. Whether a
   * chat is allowed to do anything is decided above this layer — see TelegramInboundService. */
  onUpdate(handler: (update: TelegramUpdate) => Promise<void>): void;
  start(): void;
  stop(): Promise<void>;
}
