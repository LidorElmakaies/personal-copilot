import type { Socket } from 'socket.io';

/** Implemented by InMemoryConnectionStore — maps a userId to its live socket. */
export interface IConnectionStore {
  set(userId: string, socket: Socket): void;
  remove(socket: Socket): void;
  get(userId: string): Socket | undefined;
}
