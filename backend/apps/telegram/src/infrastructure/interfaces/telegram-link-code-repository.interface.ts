import type { TelegramLinkCode } from '../../models/telegram-link';

/** Implemented by TypeOrmTelegramLinkCodeRepository. */
export interface ITelegramLinkCodeRepository {
  create(code: string, userId: string, expiresAt: Date): Promise<TelegramLinkCode>;
  findByCode(code: string): Promise<TelegramLinkCode | null>;
  markUsed(code: string): Promise<void>;
}
