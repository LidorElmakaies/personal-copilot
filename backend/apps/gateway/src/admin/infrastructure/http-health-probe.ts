import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { ServiceStatus } from '../application/interfaces/admin-status-service.interface';
import type { IHealthProbe } from '../application/interfaces/health-probe.interface';

interface HealthBody {
  status?: unknown;
  version?: unknown;
  builtAt?: unknown;
  startedAt?: unknown;
}

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

// GET <baseUrl>/health (the internal services' `{ status: 'ok', ...buildInfo }`) with a timeout.
export class HttpHealthProbe implements IHealthProbe {
  constructor(
    private readonly http: HttpService,
    readonly service: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async probe(): Promise<ServiceStatus> {
    const down: ServiceStatus = {
      service: this.service,
      status: 'down',
      version: null,
      builtAt: null,
      startedAt: null,
      latencyMs: null,
    };
    const started = Date.now();
    try {
      const { status, data } = await firstValueFrom(
        this.http.get<HealthBody>(`${this.baseUrl}/health`, {
          timeout: this.timeoutMs,
          validateStatus: () => true,
        }),
      );
      if (status !== 200 || data?.status !== 'ok') return down;
      return {
        service: this.service,
        status: 'up',
        version: stringOrNull(data.version),
        builtAt: stringOrNull(data.builtAt),
        startedAt: stringOrNull(data.startedAt),
        latencyMs: Date.now() - started,
      };
    } catch {
      return down;
    }
  }
}
