import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type {
  IServiceClient,
  ProxyRequest,
  ProxyResponse,
} from '../application/interfaces/service-client.interface';

export class ServiceHttpClient implements IServiceClient {
  constructor(
    private readonly http: HttpService,
    private readonly baseUrl: string,
    /** Prefix of the 502 error code, e.g. 'users_service' → 'users_service_unreachable'. */
    private readonly serviceName: string,
  ) {}

  async forward(request: ProxyRequest): Promise<ProxyResponse> {
    try {
      const response = await firstValueFrom(
        this.http.request({
          method: request.method,
          url: `${this.baseUrl}${request.path}`,
          data: request.body,
          headers: request.headers,
          // Every status, 4xx/5xx included, is relayed verbatim.
          validateStatus: () => true,
        }),
      );
      return { status: response.status, body: response.data as unknown };
    } catch (err) {
      const axiosErr = err as AxiosError;
      return {
        status: 502,
        body: {
          error: {
            code: `${this.serviceName}_unreachable`,
            message: axiosErr.message,
          },
        },
      };
    }
  }
}

/** Provider factory body: reads the service's base URL from config, failing fast if unset. */
export function createServiceHttpClient(
  http: HttpService,
  config: ConfigService,
  urlEnvVar: string,
  serviceName: string,
): ServiceHttpClient {
  const baseUrl = config.get<string>(urlEnvVar);
  if (!baseUrl) {
    throw new Error(`${urlEnvVar} is not configured`);
  }
  return new ServiceHttpClient(http, baseUrl, serviceName);
}
