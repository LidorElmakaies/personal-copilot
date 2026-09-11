import type {
  ProxyRequest,
  ProxyResponse,
} from '../../application/interfaces/auth-proxy-service.interface';

/** Implemented by AuthServiceHttpClient. */
export interface IAuthServiceClient {
  forward(request: ProxyRequest): Promise<ProxyResponse>;
}
