// Forwards register/login/refresh/logout to Auth Service verbatim — all unguarded. See docs/specs/services.md#gateway.
export interface ProxyRequest {
  method: 'POST';
  /** Auth Service's own path, e.g. '/auth/login'. */
  path: string;
  body?: unknown;
}

export interface ProxyResponse {
  status: number;
  body: unknown;
}

/** Implemented by AuthProxyService, consumed by the API layer. */
export interface IAuthProxyService {
  forward(request: ProxyRequest): Promise<ProxyResponse>;
}
