import { Inject, Injectable } from '@nestjs/common';
import { USER_ID_HEADER } from '@app/auth-kernel';
import { SERVICE_CLIENTS } from '../../tokens';
import type {
  IProxyService,
  ProxyRoute,
} from './interfaces/proxy-service.interface';
import type {
  ProxyResponse,
  ServiceClients,
} from './interfaces/service-client.interface';

@Injectable()
export class ProxyService implements IProxyService {
  constructor(
    @Inject(SERVICE_CLIENTS) private readonly clients: ServiceClients,
  ) {}

  forward(
    route: ProxyRoute,
    body: unknown,
    userId?: string,
  ): Promise<ProxyResponse> {
    return this.clients[route.service].forward({
      method: route.method,
      path: route.path,
      ...(body === undefined ? {} : { body }),
      ...(userId === undefined
        ? {}
        : { headers: { [USER_ID_HEADER]: userId } }),
    });
  }
}
