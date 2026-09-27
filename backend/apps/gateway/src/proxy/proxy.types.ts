// Shared by every *-proxy module: a request forwarded verbatim to one internal service.
export interface ProxyRequest {
  method: 'GET' | 'POST';
  /** The internal service's own path, e.g. '/auth/login'. */
  path: string;
  body?: unknown;
  query?: Record<string, unknown>;
}

export interface ProxyResponse {
  status: number;
  body: unknown;
}

/** Implemented by ServiceHttpClient, one instance per internal service. */
export interface IServiceClient {
  forward(request: ProxyRequest): Promise<ProxyResponse>;
}
