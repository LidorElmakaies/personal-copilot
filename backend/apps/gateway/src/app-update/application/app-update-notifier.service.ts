import { Inject, Injectable } from '@nestjs/common';
import { REALTIME_CONNECTION_SERVICE } from '../../tokens';
import type { IRealtimeConnectionService } from '../../realtime/application/interfaces/realtime-connection.interface';

// A new app release → `app-update` to every open connection; the app then re-reads latest.json
// itself (no version in the payload — Gateway's public surface never exposes versions).
@Injectable()
export class AppUpdateNotifierService {
  constructor(
    @Inject(REALTIME_CONNECTION_SERVICE)
    private readonly realtime: IRealtimeConnectionService,
  ) {}

  releasePublished(): void {
    this.realtime.broadcast('app-update', {});
  }
}
