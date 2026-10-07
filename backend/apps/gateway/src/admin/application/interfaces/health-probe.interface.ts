import type { ServiceStatus } from './admin-status-service.interface';

/** Implemented by HttpHealthProbe, one per internal service. Never throws: no answer → 'down'. */
export interface IHealthProbe {
  readonly service: string;
  probe(): Promise<ServiceStatus>;
}
