// Forwards register/login/refresh/logout/account to Users Service verbatim — all unguarded. See docs/specs/services.md#gateway.
import type { ProxyRequest, ProxyResponse } from '../../../proxy/proxy.types';

/** Implemented by AuthProxyService, consumed by the API layer. */
export interface IAuthProxyService {
  forward(request: ProxyRequest): Promise<ProxyResponse>;
}
