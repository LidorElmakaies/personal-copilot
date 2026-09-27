import { Inject, Injectable } from '@nestjs/common';
import { CALENDAR_SERVICE_CLIENT } from '../../tokens';
import type {
  IServiceClient,
  ProxyRequest,
  ProxyResponse,
} from '../../proxy/proxy.types';
import type { ICalendarProxyService } from './interfaces/calendar-proxy-service.interface';

@Injectable()
export class CalendarProxyService implements ICalendarProxyService {
  constructor(
    @Inject(CALENDAR_SERVICE_CLIENT) private readonly client: IServiceClient,
  ) {}

  forward(request: ProxyRequest): Promise<ProxyResponse> {
    return this.client.forward(request);
  }
}
