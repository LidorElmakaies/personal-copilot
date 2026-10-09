import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { IConnectionStore } from '../interfaces/connection-store.interface';

interface Connection {
  socket: Socket;
  userId: string | null;
}

// Keyed by device — single-replica only, see docs/specs/services.md#gateway for the Redis-backed
// upgrade path.
@Injectable()
export class InMemoryConnectionStore implements IConnectionStore {
  private readonly byDeviceId = new Map<string, Connection>();

  add(
    socket: Socket,
    deviceId: string,
    userId: string | null,
  ): Socket | undefined {
    const previous = this.byDeviceId.get(deviceId)?.socket;
    this.byDeviceId.set(deviceId, { socket, userId });
    return previous;
  }

  remove(socket: Socket): void {
    for (const [deviceId, connection] of this.byDeviceId) {
      if (connection.socket.id === socket.id) {
        this.byDeviceId.delete(deviceId);
        return;
      }
    }
  }

  forUser(userId: string): Socket[] {
    return [...this.byDeviceId.values()]
      .filter((connection) => connection.userId === userId)
      .map((connection) => connection.socket);
  }

  all(): Socket[] {
    return [...this.byDeviceId.values()].map((connection) => connection.socket);
  }
}
