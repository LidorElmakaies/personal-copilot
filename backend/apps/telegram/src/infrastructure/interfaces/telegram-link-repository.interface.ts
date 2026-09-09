import type { TelegramLink } from '../../models/telegram-link';

/** Implemented by TypeOrmTelegramLinkRepository. At most one row per userId and per chatId. */
export interface ITelegramLinkRepository {
  upsert(userId: string, chatId: string): Promise<TelegramLink>;
  findByChatId(chatId: string): Promise<TelegramLink | null>;
  findByUserId(userId: string): Promise<TelegramLink | null>;
  listAll(): Promise<TelegramLink[]>;
}
