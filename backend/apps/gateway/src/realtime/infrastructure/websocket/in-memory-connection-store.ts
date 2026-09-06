import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { IConnectionStore } from '../interfaces/connection-store.interface';

// One socket per user — a second login from another device replaces the first. Fine for a single
// Gateway replica (this project's actual scale); a Redis-backed store (Socket.IO's official Redis
// adapter) is the upgrade path if that ever changes.
@Injectable()
export class InMemoryConnectionStore implements IConnectionStore {
  private readonly socketsByUserId = new Map<string, Socket>();

  set(userId: string, socket: Socket): void {
    this.socketsByUserId.set(userId, socket);
  }

  remove(socket: Socket): void {
    for (const [userId, existing] of this.socketsByUserId) {
      if (existing.id === socket.id) {
        this.socketsByUserId.delete(userId);
        return;
      }
    }
  }

  get(userId: string): Socket | undefined {
    return this.socketsByUserId.get(userId);
  }
}
