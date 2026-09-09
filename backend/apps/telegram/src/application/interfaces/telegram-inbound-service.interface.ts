import type { TelegramUpdate } from '../../models/telegram-update';

/** Implemented by TelegramInboundService, driven by ITelegramClient.onUpdate. */
export interface ITelegramInboundService {
  handle(update: TelegramUpdate): Promise<void>;
}
