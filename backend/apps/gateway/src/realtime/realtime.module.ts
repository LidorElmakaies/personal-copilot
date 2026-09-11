import { Module } from '@nestjs/common';
import { AuthKernelModule } from '@app/auth-kernel';
import { RealtimeGateway } from './api/realtime.gateway';
import { RealtimeConnectionService } from './application/realtime-connection.service';
import { InMemoryConnectionStore } from './infrastructure/websocket/in-memory-connection-store';
import { CONNECTION_STORE, REALTIME_CONNECTION_SERVICE } from '../tokens';

// Exports REALTIME_CONNECTION_SERVICE so any future feature module can inject it to push to a
// user's live connection — this module owns no feature-specific message shape or origin.
@Module({
  imports: [AuthKernelModule],
  providers: [
    RealtimeGateway,
    {
      provide: REALTIME_CONNECTION_SERVICE,
      useClass: RealtimeConnectionService,
    },
    { provide: CONNECTION_STORE, useClass: InMemoryConnectionStore },
  ],
  exports: [REALTIME_CONNECTION_SERVICE],
})
export class RealtimeModule {}
