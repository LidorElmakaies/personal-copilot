// Forwards the user's reminder calls to Reminders Service. See docs/specs/services.md#gateway.
import type { ProxyRequest, ProxyResponse } from '../../../proxy/proxy.types';

/** Implemented by RemindersProxyService, consumed by the API layer. */
export interface IRemindersProxyService {
  forward(request: ProxyRequest): Promise<ProxyResponse>;
}
