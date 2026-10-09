import type {
  HttpMethod,
  InternalService,
  ProxyResponse,
} from './service-client.interface';

/** One public Gateway route, forwarded to the same path on one internal service. */
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
  forward(
    route: ProxyRoute,
    body: unknown,
    userId?: string,
  ): Promise<ProxyResponse>;
}
