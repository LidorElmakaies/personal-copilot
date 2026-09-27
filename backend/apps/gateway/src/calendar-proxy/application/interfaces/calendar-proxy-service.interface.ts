// Forwards calendar reads to Calendar Service verbatim — unguarded, works signed out. See docs/specs/services.md#gateway.
import type { ProxyRequest, ProxyResponse } from '../../../proxy/proxy.types';

/** Implemented by CalendarProxyService, consumed by the API layer. */
export interface ICalendarProxyService {
  forward(request: ProxyRequest): Promise<ProxyResponse>;
}
