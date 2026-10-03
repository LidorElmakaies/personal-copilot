import { Inject, Injectable } from '@nestjs/common';
import { USERS_SERVICE_CLIENT } from '../../tokens';
import type {
  IServiceClient,
  ProxyRequest,
  ProxyResponse,
} from '../../proxy/proxy.types';
import type { IUsersProxyService } from './interfaces/users-proxy-service.interface';

@Injectable()
export class UsersProxyService implements IUsersProxyService {
  constructor(
    @Inject(USERS_SERVICE_CLIENT)
    private readonly client: IServiceClient,
  ) {}

  forward(request: ProxyRequest): Promise<ProxyResponse> {
    return this.client.forward(request);
  }
}
