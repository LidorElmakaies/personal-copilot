import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { IConnectionStore } from '../interfaces/connection-store.interface';

// One socket per user (a second login replaces the first) — single-replica only, see
// docs/specs/services.md#gateway for the Redis-backed upgrade path.
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
