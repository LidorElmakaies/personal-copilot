// Forwards the caller's own profile calls to Users Service. See docs/specs/services.md#gateway.
import type { ProxyRequest, ProxyResponse } from '../../../proxy/proxy.types';

/** Implemented by UsersProxyService, consumed by the API layer. */
export interface IUsersProxyService {
  forward(request: ProxyRequest): Promise<ProxyResponse>;
}
