import { Inject } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AUTH_TOKEN_SERVICE, DEVICE_TOKEN_SERVICE } from '@app/auth-kernel';
import type { IAuthTokenService, IDeviceTokenService } from '@app/auth-kernel';
import { REALTIME_CONNECTION_SERVICE } from '../../tokens';
import type { IRealtimeConnectionService } from '../application/interfaces/realtime-connection.interface';

// Refusal reasons — the client sees them as `connect_error`'s message.
const DEVICE_TOKEN_INVALID = 'device_token_invalid';
const TOKEN_INVALID = 'token_invalid';

interface Identity {
  deviceId: string;
  userId: string | null;
}

// Socket.IO at /ws — see docs/specs/services.md#gateway for the handshake contract. Every
// connection needs a device token (POST /realtime/device); a login token, if sent, must verify.
@WebSocketGateway({ path: '/ws', cors: { origin: true } })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    @Inject(AUTH_TOKEN_SERVICE)
    private readonly authTokenService: IAuthTokenService,
    @Inject(DEVICE_TOKEN_SERVICE)
    private readonly deviceTokenService: IDeviceTokenService,
    @Inject(REALTIME_CONNECTION_SERVICE)
    private readonly realtimeConnectionService: IRealtimeConnectionService,
  ) {}

  // Middleware, so a refusal reaches the client as a reason it can act on, before any connection.
  afterInit(server: Server): void {
    server.use((socket, next) => {
      this.identify(socket).then(
        (identity) => {
          socket.data = identity;
          next();
        },
        (error: Error) => next(error),
      );
    });
  }

  handleConnection(socket: Socket): void {
    const { deviceId, userId } = socket.data as Identity;
    this.realtimeConnectionService.register(socket, deviceId, userId);
  }

  handleDisconnect(socket: Socket): void {
    this.realtimeConnectionService.unregister(socket);
  }

  private async identify(socket: Socket): Promise<Identity> {
    const auth = socket.handshake.auth as {
      deviceToken?: string;
      token?: string;
    };
    const deviceId = this.deviceTokenService.verify(auth.deviceToken);
    if (!deviceId) throw new Error(DEVICE_TOKEN_INVALID);
    if (!auth.token) return { deviceId, userId: null };
    const identity = await this.authTokenService.verify(auth.token);
    if (!identity) throw new Error(TOKEN_INVALID);
    return { deviceId, userId: identity.userId };
  }
}
