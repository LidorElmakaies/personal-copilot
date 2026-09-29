// Forwards push-subscription calls to Notification Service. See docs/specs/services.md#gateway.
import type { ProxyRequest, ProxyResponse } from '../../../proxy/proxy.types';

/** Implemented by NotificationsProxyService, consumed by the API layer. */
export interface INotificationsProxyService {
  forward(request: ProxyRequest): Promise<ProxyResponse>;
}
