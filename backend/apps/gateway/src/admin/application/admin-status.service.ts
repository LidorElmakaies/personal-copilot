import { Inject, Injectable } from '@nestjs/common';
import { buildInfo } from '@app/build-info';
import { HEALTH_PROBES } from '../../tokens';
import type {
  IAdminStatusService,
  ServiceStatus,
} from './interfaces/admin-status-service.interface';
import type { IHealthProbe } from './interfaces/health-probe.interface';

@Injectable()
export class AdminStatusService implements IAdminStatusService {
  constructor(@Inject(HEALTH_PROBES) private readonly probes: IHealthProbe[]) {}

  async status(): Promise<ServiceStatus[]> {
    const own: ServiceStatus = {
      ...buildInfo('gateway'),
      status: 'up',
      latencyMs: null,
    };
    return [own, ...(await Promise.all(this.probes.map((p) => p.probe())))];
  }
}
