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

  register(userId: string, socket: Socket): void {
    this.connectionStore.set(userId, socket);
  }

  unregister(socket: Socket): void {
    this.connectionStore.remove(socket);
  }

  pushToUser<T extends object>(
    userId: string,
    event: string,
    payload: T,
  ): boolean {
    const socket = this.connectionStore.get(userId);
    if (!socket) return false;
    socket.emit(event, payload);
    return true;
  }
}
