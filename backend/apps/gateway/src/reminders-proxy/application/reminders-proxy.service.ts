import { Inject, Injectable } from '@nestjs/common';
import { REMINDERS_SERVICE_CLIENT } from '../../tokens';
import type {
  IServiceClient,
  ProxyRequest,
  ProxyResponse,
} from '../../proxy/proxy.types';
import type { IRemindersProxyService } from './interfaces/reminders-proxy-service.interface';

@Injectable()
export class RemindersProxyService implements IRemindersProxyService {
  constructor(
    @Inject(REMINDERS_SERVICE_CLIENT)
    private readonly client: IServiceClient,
  ) {}

  forward(request: ProxyRequest): Promise<ProxyResponse> {
    return this.client.forward(request);
  }
}
