import { Inject, Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { CONNECTION_STORE } from '../../tokens';
import type { IConnectionStore } from '../infrastructure/interfaces/connection-store.interface';
import type { IRealtimeConnectionService } from './interfaces/realtime-connection.interface';

@Injectable()
export class RealtimeConnectionService implements IRealtimeConnectionService {
  constructor(
    @Inject(CONNECTION_STORE)
    private readonly connectionStore: IConnectionStore,
  ) {}

  register(socket: Socket, deviceId: string, userId: string | null): void {
    this.connectionStore.add(socket, deviceId, userId)?.disconnect(true);
  }

  unregister(socket: Socket): void {
    this.connectionStore.remove(socket);
  }

  pushToUser<T extends object>(
    userId: string,
    event: string,
    payload: T,
  ): boolean {
    const sockets = this.connectionStore.forUser(userId);
    for (const socket of sockets) socket.emit(event, payload);
    return sockets.length > 0;
  }

  broadcast<T extends object>(event: string, payload: T): number {
    const sockets = this.connectionStore.all();
    for (const socket of sockets) socket.emit(event, payload);
    return sockets.length;
  }
}
