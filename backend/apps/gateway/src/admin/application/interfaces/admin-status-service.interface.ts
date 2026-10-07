// What GET /admin/status returns — one entry per backend service. See docs/specs/services.md#gateway.

export interface ServiceStatus {
  service: string;
  status: 'up' | 'down';
  version: string | null;
  builtAt: string | null;
  startedAt: string | null;
  /** Round trip to its /health; null for Gateway itself (read in-process) and for a service that's down. */
  latencyMs: number | null;
}

/** Implemented by AdminStatusService, consumed by the API layer. */
export interface IAdminStatusService {
  status(): Promise<ServiceStatus[]>;
}
