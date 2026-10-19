import type {
  HttpMethod,
  InternalService,
  ProxyResponse,
} from './service-client.interface';

/** One public Gateway route, forwarded to the same path on one internal service (`:param`s filled in). */
export interface ProxyRoute {
  method: HttpMethod;
  path: string;
  service: InternalService;
  /** 'user': JwtAuthGuard, and the token's user id is forwarded as X-User-Id. */
  auth: 'none' | 'user';
  /** 'strict': authStrictThrottlePolicy in place of the global limit. */
  throttle?: 'strict';
}

/** Implemented by ProxyService, consumed by the API layer. */
export interface IProxyService {
  /** `path`: the route's, with its params and a GET's query string filled in. */
  forward(
    route: ProxyRoute,
    path: string,
    body: unknown,
    userId?: string,
  ): Promise<ProxyResponse>;
}
