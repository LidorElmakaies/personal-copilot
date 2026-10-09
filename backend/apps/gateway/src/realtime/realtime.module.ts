import { Module } from '@nestjs/common';
import { AuthKernelModule } from '@app/auth-kernel';
import { RealtimeController } from './api/realtime.controller';
import { RealtimeGateway } from './api/realtime.gateway';
import { RealtimeConnectionService } from './application/realtime-connection.service';
import { InMemoryConnectionStore } from './infrastructure/websocket/in-memory-connection-store';
import { CONNECTION_STORE, REALTIME_CONNECTION_SERVICE } from '../tokens';

// Exports REALTIME_CONNECTION_SERVICE so any feature module can inject it to push to a user's
// devices or broadcast to all — this module owns no feature-specific message shape or origin.
@Module({
  imports: [AuthKernelModule],
  controllers: [RealtimeController],
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
