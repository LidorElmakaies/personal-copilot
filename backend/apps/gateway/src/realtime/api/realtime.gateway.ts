import { Inject } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { AUTH_TOKEN_SERVICE } from '@app/auth-kernel';
import type { IAuthTokenService } from '@app/auth-kernel';
import { REALTIME_CONNECTION_SERVICE } from '../../tokens';
import type { IRealtimeConnectionService } from '../application/interfaces/realtime-connection.interface';

// Socket.IO at /ws — see docs/specs/services.md#gateway for the handshake/pushToUser contract.
@WebSocketGateway({ path: '/ws', cors: { origin: true } })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    @Inject(AUTH_TOKEN_SERVICE)
    private readonly authTokenService: IAuthTokenService,
    @Inject(REALTIME_CONNECTION_SERVICE)
    private readonly realtimeConnectionService: IRealtimeConnectionService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;
    const identity = await this.authTokenService.verify(token);
    if (!identity) {
      socket.disconnect(true);
      return;
    }
    this.realtimeConnectionService.register(identity.userId, socket);
  }

  handleDisconnect(socket: Socket): void {
    this.realtimeConnectionService.unregister(socket);
  }
}
