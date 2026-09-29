import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATIONS_SERVICE_CLIENT } from '../../tokens';
import type {
  IServiceClient,
  ProxyRequest,
  ProxyResponse,
} from '../../proxy/proxy.types';
import type { INotificationsProxyService } from './interfaces/notifications-proxy-service.interface';

@Injectable()
export class NotificationsProxyService implements INotificationsProxyService {
  constructor(
    @Inject(NOTIFICATIONS_SERVICE_CLIENT)
    private readonly client: IServiceClient,
  ) {}

  forward(request: ProxyRequest): Promise<ProxyResponse> {
    return this.client.forward(request);
  }
}
