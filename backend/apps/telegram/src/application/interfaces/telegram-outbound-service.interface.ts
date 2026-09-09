import type { TelegramSendMessage } from '@app/kafka-contracts';

/** Implemented by TelegramOutboundService, driven by the TELEGRAM_MESSAGE_SEND consumer. */
export interface ITelegramOutboundService {
  send(message: TelegramSendMessage): Promise<void>;
}
