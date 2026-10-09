import type { Socket } from 'socket.io';

/** Implemented by InMemoryConnectionStore — one live socket per device, and who's signed in on it. */
export interface IConnectionStore {
  /** userId null: anonymous. Returns the device's previous socket if it still had one open. */
  add(
    socket: Socket,
    deviceId: string,
    userId: string | null,
  ): Socket | undefined;
  /** No-op unless `socket` is still its device's current one. */
  remove(socket: Socket): void;
  /** Every device the user is signed in on. */
  forUser(userId: string): Socket[];
  all(): Socket[];
}
