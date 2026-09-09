/** Implemented by TelegramProxyService, consumed by the API layer. Fire-and-forget — the actual
 * code arrives later over the caller's WS connection (see TelegramLinkCreatedConsumer), not in the
 * HTTP response. */
export interface ITelegramProxyService {
  requestLinkCode(userId: string): Promise<void>;
}
