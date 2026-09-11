import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { IAuthServiceClient } from './interfaces/auth-service-client.interface';
import type {
  ProxyRequest,
  ProxyResponse,
} from '../application/interfaces/auth-proxy-service.interface';

// Plain HTTP (not Kafka) — this needs a synchronous request/response.
@Injectable()
export class AuthServiceHttpClient implements IAuthServiceClient {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    const authServiceUrl = config.get<string>('AUTH_SERVICE_URL');
    if (!authServiceUrl) {
      throw new Error('AUTH_SERVICE_URL is not configured');
    }
    this.baseUrl = authServiceUrl;
  }

  async forward(request: ProxyRequest): Promise<ProxyResponse> {
    try {
      const response = await firstValueFrom(
        this.http.request({
          method: request.method,
          url: `${this.baseUrl}${request.path}`,
          data: request.body,
          // Never reject on 4xx/5xx — every status is relayed verbatim, not treated as an error.
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
            code: 'auth_service_unreachable',
            message: axiosErr.message,
          },
        },
      };
    }
  }
}
