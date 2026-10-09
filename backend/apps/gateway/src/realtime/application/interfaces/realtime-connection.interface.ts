import type { Socket } from 'socket.io';

/** Implemented by RealtimeConnectionService — the entry point any feature uses to reach clients. */
export interface IRealtimeConnectionService {
  /**
   * One connection per device: a newer one closes the device's previous socket (a phone that
   * switched networks reconnects before the old connection times out). userId null: anonymous.
   */
  register(socket: Socket, deviceId: string, userId: string | null): void;
  unregister(socket: Socket): void;
  /** Emits `event`/`payload` on every device the user is connected from. False if none. */
  pushToUser<T extends object>(
    userId: string,
    event: string,
    payload: T,
  ): boolean;
  /** Emits `event`/`payload` to every open connection, signed in or not. Returns how many. */
  broadcast<T extends object>(event: string, payload: T): number;
}
